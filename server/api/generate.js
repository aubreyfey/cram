import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const client = new Anthropic();

const MODEL = process.env.CRAM_MODEL || 'claude-opus-5';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const DeckSchema = z.object({
  title: z.string().describe('Short deck name, 2-5 words, from the content'),
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
    .describe('Between 6 and 20 cards'),
});

const SYSTEM = `You turn a photo of study material into flashcards.

The photo is a lecture slide, textbook page, or handwritten student notes. It may
be blurry, at an angle, or badly lit. Read what you can.

Rules:
- Write cards that test understanding, not trivia. Prefer "why does X happen"
  over "what year did X happen" unless the material is genuinely a list of dates.
- One idea per card. If a concept has three parts, that is three cards.
- The front is a real question a professor would ask. Never "What is [term]?"
  repeated for every term - vary the framing.
- The back is one or two sentences. No preamble, no "The answer is".
- Use the wording and notation from the source. If they wrote "ATP synthase",
  do not switch to "the enzyme that makes ATP".
- Skip page numbers, headers, the lecturer's name, and course admin.
- 6 to 20 cards depending on how much is actually on the page. Do not pad.

If the photo has no study content at all (a face, a wall, a menu), return an
empty cards array rather than inventing material.`;

// In-memory rate limit. Serverless instances are ephemeral and not shared, so
// this only catches the naive case. See README - real auth is required before
// this endpoint sees any volume.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 12;
  const entry = hits.get(ip)?.filter((t) => now - t < window) ?? [];
  entry.push(now);
  hits.set(ip, entry);
  if (hits.size > 5000) hits.clear();
  return entry.length > max;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (process.env.CRAM_APP_KEY && req.headers['x-cram-key'] !== process.env.CRAM_APP_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const { image } = req.body || {};
  if (typeof image !== 'string' || !image.length) {
    return res.status(400).json({ error: 'missing_image' });
  }
  if (image.length * 0.75 > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'image_too_large' });
  }

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      // Low effort: this is extraction, not reasoning, and the product promise
      // is a sub-3-second turnaround. Raise to "medium" only if card quality
      // measurably drops - it costs latency.
      output_config: {
        effort: 'low',
        format: zodOutputFormat(DeckSchema),
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            { type: 'text', text: 'Make flashcards from this page.' },
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
