// Design tokens. The look is the product here, so everything visual
// resolves through this file - no ad-hoc colors in components.

export const colors = {
  bg: '#0B0B0F',
  surface: '#16161D',
  surfaceHi: '#22222C',
  line: '#2C2C38',

  text: '#F5F5F7',
  textDim: '#8E8E9A',
  textFaint: '#5A5A66',

  // Acid lime on near-black. Chosen to survive video compression and to
  // not look like every other purple-gradient AI app in the feed.
  accent: '#D4FF3F',
  accentInk: '#0B0B0F',
  violet: '#7C5CFF',

  good: '#4ADE80',
  hard: '#FBBF24',
  again: '#FB7185',
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

export const space = (n) => n * 4;

export const type = {
  hero: { fontSize: 40, fontWeight: '800', letterSpacing: -1.2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  card: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, lineHeight: 32 },
  body: { fontSize: 16, fontWeight: '500', lineHeight: 23 },
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  mono: { fontSize: 12, fontWeight: '600', letterSpacing: 1.4 },
};

// Springs tuned to feel snappy rather than floaty. Every interaction in the
// app uses one of these three so the whole thing moves as one object.
export const motion = {
  snap: { damping: 18, stiffness: 260, mass: 0.7 },
  soft: { damping: 22, stiffness: 140, mass: 0.9 },
  pop: { damping: 12, stiffness: 400, mass: 0.6 },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};

// Volt, the mascot. Slate body in the surface family, bone eye discs, and the
// accent spent only on the irises and the card it holds. See assets/mascot.
export const mascot = {
  body: '#262630',
  edge: '#3B3B49',
  wing: '#1C1C24',
  belly: '#30303C',
  bone: colors.text,
  ash: colors.textDim,
  ink: colors.bg,
  volt: colors.accent,
};
