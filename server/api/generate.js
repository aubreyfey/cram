import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { isAdminCode } from './admin.js';

const client = new Anthropic();

// Two models, by tier. Free users are the cost exposure - they pay nothing
// and a free scan on Opus costs 5x what it does on Haiku. Subscribers (and
// admins) get the best model because that is what they are paying for.
const MODEL = process.env.CRAM_MODEL || 'claude-opus-5';
const MODEL_FREE = process.env.CRAM_MODEL_FREE || 'claude-haiku-4-5-20251001';

const ACCEPTED = {
  'image/jpeg': { kind: 'image', maxBytes: 6 * 1024 * 1024 },
  'image/png': { kind: 'image', maxBytes: 6 * 1024 * 1024 },
  'image/webp': { kind: 'image', maxBytes: 6 * 1024 * 1024 },
  'image/heic': { kind: 'image', maxBytes: 6 * 1024 * 1024 },
  'application/pdf': { kind: 'document', maxBytes: 16 * 1024 * 1024 },
};

// A lecture is a handful of slides photographed one after another. Twenty
// pages at 1400px is ~20MB of base64 and well inside the model's limits;
// past that the upload alone takes longer than anyone will wait.
const MAX_PAGES = 20;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const DeckSchema = z.object({
  title: z.string().describe('Short deck name, 2-5 words, drawn from the content'),
  subject: z
    .string()
    .describe('Academic subject, e.g. "Organic Chemistry". Empty string if unclear.'),
  cards: z
    .array(
      z.object({
        front: z.string().describe('The question or prompt side'),
        back: z.string().describe('The answer side, one or two sentences'),
        hint: z.string().describe('Optional nudge. Empty string if none.'),
      }),
    )
    .describe('Flashcards covering the material'),
});

const SYSTEM = `You turn study material into flashcards.

The input is a lecture slide, textbook page, handwritten student notes, or a
multi-page PDF of any of those. Photos may be blurry, at an angle, or badly lit.
Read what you can.

Rules:
- Write cards that test understanding, not trivia. Prefer "why does X happen"
  over "what year did X happen" unless the material is genuinely a list of dates.
- One idea per card. If a concept has three parts, that is three cards.
- The front is a real question a professor would ask. Never "What is [term]?"
  repeated for every term - vary the framing.
- The back is one or two sentences. No preamble, no "The answer is".
- Use the wording and notation from the source. If they wrote "ATP synthase",
  do not switch to "the enzyme that makes ATP".
- Skip page numbers, headers, the lecturer's name, references and course admin.
- For a multi-page document, cover the whole thing rather than exhausting page
  one. Weight coverage toward what the material spends the most time on.
- Do not pad. A thin page gets few cards; that is the correct outcome.

Length: a single page or image should yield 6 to 20 cards. A multi-page document
should yield roughly 8 to 15 cards per substantive page, up to a maximum of 120.

If there is no study content at all (a face, a wall, a menu, an invoice), return
an empty cards array rather than inventing material.`;

// In-memory rate limit. Serverless instances are ephemeral and not shared, so
// this only catches the naive case. See README - real auth is required before
// this endpoint sees any volume.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip)?.filter((t) => now - t < 60_000) ?? [];
  entry.push(now);
  hits.set(ip, entry);
  if (hits.size > 5000) hits.clear();
  return entry.length > 12;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (process.env.CRAM_APP_KEY && req.headers['x-cram-key'] !== process.env.CRAM_APP_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Admins (the people who run this thing) skip the per-IP limit - testing a
  // build means firing off a dozen scans in a minute.
  const admin = isAdminCode(req.headers['x-cram-admin']);
  // The tier header is a cost switch, not a security boundary: a free user
  // who forges "pro" gets a better model for their 10 cards a day, nothing
  // more. Real enforcement is receipt verification - see README, Security.
  const paid = admin || req.headers['x-cram-tier'] === 'pro';
  const model = paid ? MODEL : MODEL_FREE;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!admin && rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  // Either one { data, mediaType } (a photo or a PDF) or { pages: [...] } of
  // several photos that belong together. Normalise to a list.
  const body = req.body || {};
  const pages = Array.isArray(body.pages) ? body.pages : [body];
  if (!pages.length || pages.length > MAX_PAGES) {
    return res.status(400).json({ error: 'bad_page_count' });
  }

  let kind = null;
  let total = 0;
  const blocks = [];
  for (const page of pages) {
    const { data, mediaType } = page || {};
    if (typeof data !== 'string' || !data.length) {
      return res.status(400).json({ error: 'missing_data' });
    }
    const spec = ACCEPTED[mediaType];
    if (!spec) {
      return res.status(415).json({ error: 'unsupported_media_type' });
    }
    // A PDF is already many pages; mixing one into a photo batch makes no
    // sense and would blow the size budget.
    if (spec.kind === 'document' && pages.length > 1) {
      return res.status(400).json({ error: 'pdf_must_be_alone' });
    }
    const bytes = data.length * 0.75;
    total += bytes;
    if (bytes > spec.maxBytes || total > MAX_TOTAL_BYTES) {
      return res.status(413).json({ error: 'too_large' });
    }
    kind = spec.kind;
    // Image and PDF take different content-block types; everything downstream
    // is identical, which is why the schema and prompt are shared.
    const source = { type: 'base64', media_type: mediaType, data };
    blocks.push(kind === 'document' ? { type: 'document', source } : { type: 'image', source });
  }

  const spec = { kind, multi: kind === 'document' || pages.length > 1 };

  try {
    const response = await client.messages.parse({
      model,
      // A long PDF or a stack of photos can legitimately produce a hundred
      // cards, and 120 cards is ~10k output tokens. Stay under ~21k: above
      // that the SDK refuses non-streaming requests outright.
      max_tokens: spec.multi ? 20000 : 12000,
      system: SYSTEM,
      // Low effort: this is extraction, not reasoning, and the product promise
      // is a fast turnaround. Raise to "medium" only if card quality
      // measurably drops - it costs latency.
      output_config: {
        effort: 'low',
        format: zodOutputFormat(DeckSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            ...blocks,
            {
              type: 'text',
              text:
                spec.kind === 'document'
                  ? 'Make flashcards from this document.'
                  : blocks.length > 1
                    ? `Make flashcards from these ${blocks.length} pages. They are consecutive pages of the same material, in order - treat them as one document.`
                    : 'Make flashcards from this page.',
            },
          ],
        },
      ],
    });

    // A refusal returns HTTP 200 with no usable content - guard before reading.
    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'refused' });
    }

    const deck = response.parsed_output;
    if (!deck) {
      return res.status(502).json({ error: 'parse_failed' });
    }

    return res.status(200).json({
      title: deck.title,
      subject: deck.subject || null,
      cards: deck.cards
        .filter((c) => c.front?.trim() && c.back?.trim())
        .map((c) => ({ front: c.front, back: c.back, hint: c.hint || null })),
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'upstream_rate_limited' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY is missing or invalid');
      return res.status(500).json({ error: 'server_misconfigured' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}:`, err.message);
      return res.status(502).json({ error: 'upstream_error' });
    }
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
