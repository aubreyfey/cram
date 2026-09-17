// Renders assets/mascot/volt-*.gif from the vector. Needs sharp >= 0.34:
//   npm i -g sharp && node assets/mascot/render-gifs.js
// Not a project dependency - it is a one-off tool, not app code.

const sharp = require('sharp');
const fs = require('fs');
const APP = 'C:/Users/aubre/Desktop/APP';
const C = { body:'#262630', edge:'#3B3B49', wing:'#1C1C24', belly:'#30303C', bone:'#F5F5F7', ash:'#8E8E9A', ink:'#0B0B0F', volt:'#D4FF3F' };
const BODY = 'M64 20 C88 20 104 40 104 72 C104 100 88 118 64 118 C40 118 24 100 24 72 C24 40 40 20 64 20 Z';

// One frame of Volt. Every argument is something the app animates too.
function frame({ bob = 0, blink = 1, look = 0, tilt = 0, lids = [41, 47], happy = false, oops = false, cardLift = 0, pop = 1, bg = null }) {
  const flare = oops ? 7 : 0;
  const [lo, li] = lids;
  const eyes = happy
    ? `<path d="M34 56 A13 13 0 0 1 60 56" stroke="${C.bone}" stroke-width="5" stroke-linecap="round" fill="none"/>
       <path d="M68 56 A13 13 0 0 1 94 56" stroke="${C.bone}" stroke-width="5" stroke-linecap="round" fill="none"/>`
    : `<ellipse cx="47" cy="52" rx="17" ry="${17*blink}" fill="${C.bone}"/><ellipse cx="81" cy="52" rx="17" ry="${17*blink}" fill="${C.bone}"/>
       <ellipse cx="${47+look}" cy="52" rx="10" ry="${10*blink}" fill="${C.volt}"/><ellipse cx="${81+look}" cy="52" rx="10" ry="${10*blink}" fill="${C.volt}"/>
       <ellipse cx="${47+look}" cy="52" rx="5" ry="${5*blink}" fill="${C.ink}"/><ellipse cx="${81+look}" cy="52" rx="5" ry="${5*blink}" fill="${C.ink}"/>
       ${blink > 0.5 ? `<circle cx="${44.5+look}" cy="49.5" r="2.2" fill="${C.bone}"/><circle cx="${78.5+look}" cy="49.5" r="2.2" fill="${C.bone}"/>` : ''}
       <g clip-path="url(#clip)">
         <path d="M26 ${lo} L64 ${li} L64 28 L26 28 Z" fill="${C.body}"/><path d="M102 ${lo} L64 ${li} L64 28 L102 28 Z" fill="${C.body}"/>
         <path d="M28 ${lo} L64 ${li} L100 ${lo}" stroke="${C.edge}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
       </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="320" height="320">
  ${bg ? `<rect width="128" height="128" fill="${bg}"/>` : ''}
  <defs><clipPath id="clip"><path d="${BODY}"/></clipPath></defs>
  <g transform="translate(64 ${70+bob}) scale(${pop}) rotate(${tilt}) translate(-64 -70)">
    <path d="M34 36 L42 10 L58 30 Z" fill="${C.body}" stroke="${C.edge}" stroke-width="3" stroke-linejoin="round" transform="rotate(${-flare} 46 34)"/>
    <path d="M94 36 L86 10 L70 30 Z" fill="${C.body}" stroke="${C.edge}" stroke-width="3" stroke-linejoin="round" transform="rotate(${flare} 82 34)"/>
    <path d="${BODY}" fill="${C.body}" stroke="${C.edge}" stroke-width="3"/>
    <g clip-path="url(#clip)">
      <path d="M32 58 C24 76 26 98 38 112 C45 98 45 76 32 58 Z" fill="${C.wing}"/>
      <path d="M96 58 C104 76 102 98 90 112 C83 98 83 76 96 58 Z" fill="${C.wing}"/>
      <rect x="48" y="76" width="32" height="32" rx="16" fill="${C.belly}"/>
    </g>
    ${eyes}
    <path d="M58 63 L70 63 L64 73 Z" fill="${C.ash}"/>
    <g transform="translate(0 ${-cardLift}) rotate(-12 88 98)">
      <rect x="74" y="88" width="28" height="20" rx="4" fill="${C.volt}"/>
      <rect x="79" y="94" width="14" height="2.5" rx="1.25" fill="${C.ink}"/>
      <rect x="79" y="100" width="9" height="2.5" rx="1.25" fill="${C.ink}"/>
    </g>
    <rect x="46" y="112" width="13" height="8" rx="4" fill="${C.ash}"/>
    <rect x="69" y="112" width="13" height="8" rx="4" fill="${C.ash}"/>
  </g>
</svg>`;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);
const sin = (t) => Math.sin(t * Math.PI * 2);

// Idle: 3s loop at 25fps. Bob, one blink at 1.4s, a glance right then back.
function idleFrames(bg) {
  const N = 75, out = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const bob = -4 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
    let blink = 1;
    const b = (i - 35);
    if (b >= 0 && b < 5) blink = b < 2 ? 1 - 0.92 * (b + 1) / 2 : 0.08 + 0.92 * (b - 1) / 3;
    let look = 0;
    if (i >= 50 && i < 70) { const u = (i - 50) / 20; look = 4 * Math.sin(u * Math.PI); }
    const tilt = 1.5 * sin(t);
    out.push(frame({ bob, blink, look, tilt, bg }));
  }
  return out;
}

// Happy: 1.6s, plays once then holds. Eyes close, hop, tilt wag, card lifts.
function happyFrames(bg) {
  const N = 27, out = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const hop = i < 8 ? -22 * ease(i / 8) : i < 20 ? -22 * (1 - ease((i - 8) / 12)) : 0;
    const tilt = i < 6 ? 9 * (i / 6) : i < 12 ? 9 - 18 * ((i - 6) / 6) : i < 18 ? -9 + 14 * ((i - 12) / 6) : i < 26 ? 5 * (1 - (i - 18) / 8) : 0;
    const pop = i < 5 ? 1 + 0.18 * (i / 5) : i < 16 ? 1.18 - 0.18 * ease((i - 5) / 11) : 1;
    const cardLift = 6 * Math.min(1, i / 6);
    out.push(frame({ bob: hop, tilt, pop, happy: true, cardLift, bg }));
  }
  return out;
}

// Oops: 1.2s. Lids drop, tufts flare, quick head-shake, small dip.
function oopsFrames(bg) {
  const N = 12, out = [];
  const shake = [0, -10, -10, 4, 10, 10, 2, -6, -6, -2, 0];
  for (let i = 0; i < N; i++) {
    const tilt = i < shake.length ? shake[i] : 0;
    const bob = i < 3 ? 5 * (i / 3) : i < 10 ? 5 * (1 - (i - 3) / 7) : 0;
    const p = Math.min(1, i / 3);
    out.push(frame({ bob, tilt, oops: true, lids: [41 + 5 * p, 47 + 5 * p], bg }));
  }
  return out;
}

async function writeGif(name, svgs, { loop, delay, hold = 0 }) {
  const pngs = await Promise.all(svgs.map((s) => sharp(Buffer.from(s), { density: 72 }).resize(320, 320).png().toBuffer()));
  await sharp(pngs, { join: { animated: true } })
    .gif({ loop, delay: hold ? svgs.map((_, i) => (i === svgs.length - 1 ? hold : delay)) : delay, effort: 7, dither: 0 })
    .toFile(`${APP}/assets/mascot/${name}.gif`);
  const m = await sharp(`${APP}/assets/mascot/${name}.gif`).metadata();
  console.log(name.padEnd(18), `${m.width}x${m.height}`, `${m.pages} frames`, `${(fs.statSync(`${APP}/assets/mascot/${name}.gif`).size / 1024).toFixed(0)}KB`);
}

(async () => {
  await writeGif('volt-idle', idleFrames(null), { loop: 0, delay: 40 });
  await writeGif('volt-idle-dark', idleFrames('#0B0B0F'), { loop: 0, delay: 40 });
  await writeGif('volt-happy', happyFrames(null), { loop: 0, delay: 40, hold: 1500 });
  await writeGif('volt-oops', oopsFrames(null), { loop: 0, delay: 40, hold: 1500 });
  // Contact strip of the idle loop so it can be eyeballed as stills.
  const picks = [0, 18, 36, 37, 38, 55, 60];
  const tiles = await Promise.all(picks.map((i) => sharp(Buffer.from(idleFrames('#16161D')[i]), { density: 120 }).resize(160, 160).png().toBuffer()));
  await sharp({ create: { width: 160 * picks.length, height: 160, channels: 3, background: '#16161D' } })
    .composite(tiles.map((input, k) => ({ input, left: 160 * k, top: 0 }))).png().toFile('strip.png');
  console.log('strip written');
})().catch((e) => { console.error(e); process.exit(1); });
