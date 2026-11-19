/* The new look: the colours, radii and shadows of the prototype (docs/reference/FleetPilot_Phone_Platform_Fonts_Scale080.html).
   Light is the default. Dark is used when the phone is in dark mode (or when the person chooses it in Settings).

   The old names (panel, panel2, panel3, inkDim, inkFaint, amber, amberDim, fuel) are kept and now point at the new
   colours, so every screen that has not been restyled yet is recoloured at once instead of looking half old.
   The new names (card, card2, dim, gold, goldt, ... ) are what the restyled screens use. */

const make = (core, extra) => {
  const t = { ...core, ...extra };
  return {
    ...t,
    /* old names */
    panel: t.card, panel2: t.card2, panel3: t.card2, inkDim: t.dim, inkFaint: t.dim,
    amber: t.goldt, amberDim: t.gold, fuel: t.orange
  };
};

export const LIGHT = make({
  bg: '#F4F2ED', card: '#FFFFFF', card2: '#EFEBE3', line: '#E4DFD3', ink: '#14181D', dim: '#6B7280',
  gold: '#F6B94A', goldt: '#A8710A', goldbg: 'rgba(232,166,42,0.16)',
  green: '#1E9B52', greenbg: 'rgba(30,155,82,0.12)', red: '#D64541', redbg: 'rgba(214,69,65,0.11)',
  blue: '#1F86C4', bluebg: 'rgba(31,134,196,0.12)', orange: '#D9631E', orangebg: 'rgba(217,99,30,0.12)',
  onfab: '#1A1305', warn: '#FBF0DC', warnline: '#EBCB8A', tab: '#FFFFFF'
}, { shadowColor: '#3C2D0A', shadowOpacity: 0.08, name: 'light' });

export const DARK = make({
  bg: '#07090D', card: '#0F1319', card2: '#171D26', line: '#1F2630', ink: '#F1F3F5', dim: '#8D97A5',
  gold: '#F6B94A', goldt: '#F6B94A', goldbg: 'rgba(246,185,74,0.15)',
  green: '#4BCB7C', greenbg: 'rgba(75,203,124,0.14)', red: '#EF5350', redbg: 'rgba(239,83,80,0.15)',
  blue: '#4DB6F0', bluebg: 'rgba(77,182,240,0.14)', orange: '#F5873F', orangebg: 'rgba(245,135,63,0.15)',
  onfab: '#1A1305', warn: '#1D1710', warnline: '#4A3719', tab: '#0B0E13'
}, { shadowColor: '#000000', shadowOpacity: 0.4, name: 'dark' });

/* the phone's setting decides unless the person chose Light or Dark: 'auto' | 'light' | 'dark' */
export const paletteFor = (scheme, choice = 'auto') => {
  if (choice === 'dark') return DARK;
  if (choice === 'light') return LIGHT;
  return scheme === 'dark' ? DARK : LIGHT;
};

/* colours that are the same in both looks */
export const FIXED = {
  hero: { from: '#222c38', to: '#0c1016', border: '#2a323d', glow: 'rgba(246,185,74,0.22)', text: '#FFFFFF', dim: '#aab3bf', eyebrow: '#F6B94A' },
  fab: { from: '#FACB6A', to: '#F3AC30', glow: 'rgba(246,185,74,0.5)' },
  toast: { bg: '#14181D', text: '#FFFFFF' },
  splash: { bg: '#000000', gold: '#F6B94A', text: '#FFFFFF' },
  trend: { revenue: '#E8A62A' },
  alertBorder: 'rgba(214,69,65,0.35)',
  pulse: 'rgba(214,69,65,0.55)'
};

/* a different colour for each car, in the order of the cars (the prototype's eight, repeated) */
export const CAR_COLOURS = ['#B6D43C', '#8B86F0', '#12C9C0', '#F57C4A', '#D470D0', '#4BCB7C', '#4DB6F0', '#F6B94A'];
export const carColour = index => CAR_COLOURS[((Number(index) || 0) % CAR_COLOURS.length + CAR_COLOURS.length) % CAR_COLOURS.length];

/* sizes at display size 1 (the prototype's pixels). The look multiplies these by the display size. */
export const SIZE = {
  radius: { card: 22, hero: 26, button: 14, chip: 20, badge: 12, field: 14, sheet: 28, panel: 18, seg: 26, quick: 20 },
  field: 52, button: 52, search: 48, roundBtn: 44, circleBtn: 40, pageHead: 56, tabIcon: 26, fab: 62, fabRaise: 30
};

/* the old status bar looks stay until Step 2 replaces the bar */
export const BAR = {
  on: { background: '#1F7A4D', text: '#FFFFFF', dot: '#7DFFB5' },
  sy: { background: '#1F7A4D', text: '#FFFFFF', dot: '#7DFFB5' },
  ask: { background: '#B36B00', text: '#FFFFFF', dot: '#FFD27A' },
  off: { background: '#2B3640', text: '#CFD8DE', dot: '#8A98A3' }
};

export const ARRIVED_DOT = { color: '#2FB36B', ring: 'rgba(47,179,107,0.25)', size: 9 };
export const RADIUS = { card: SIZE.radius.card, button: SIZE.radius.button };
export const MONO = 'monospace';                       // the fallback when the font file has not loaded
export const FONT_MONO = { regular: 'JetBrainsMono_500Medium', bold: 'JetBrainsMono_700Bold' };
