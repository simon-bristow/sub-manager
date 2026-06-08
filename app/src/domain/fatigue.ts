// Fatigue colour gradient: blue → green → amber → red, relative to most-played.
export function fatigueColor(timeOnPitch: number, maxTime: number): string {
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
  return `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;
}
