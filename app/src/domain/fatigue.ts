// Fatigue colour gradient: blue → green → amber → red, relative to most-played.

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function fatigueHsl(timeOnPitch: number, maxTime: number): Hsl {
  const max = Math.max(1, maxTime);
  const ratio = Math.min(1, timeOnPitch / max);
  let h: number;
  let s: number;
  let l: number;
  if (ratio < 0.5) {
    const t = ratio * 2;
    h = 210 - t * 170;
    s = 15 + t * 75;
    l = 60 - t * 10;
  } else {
    const t = (ratio - 0.5) * 2;
    h = 40 - t * 40;
    s = 90;
    l = 50 - t * 5;
  }
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

export function fatigueColor(timeOnPitch: number, maxTime: number): string {
  const { h, s, l } = fatigueHsl(timeOnPitch, maxTime);
  return `hsl(${h},${s}%,${l}%)`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Background tint + contrasting text colour for a whole player card, so the
// fatigue level reads at a glance from the card itself, not just the clock.
export function fatigueCardStyle(
  timeOnPitch: number,
  maxTime: number,
): { background: string; color: string } {
  const { h, s, l } = fatigueHsl(timeOnPitch, maxTime);
  const [r, g, b] = hslToRgb(h, s, l);
  // Perceived luminance (0–1) → dark text on bright fills, light text on dark.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const color = lum > 0.6 ? '#0e1a2b' : '#ffffff';
  return { background: `hsl(${h},${s}%,${l}%)`, color };
}
