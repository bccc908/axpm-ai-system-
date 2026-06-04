/** Douyin-style vertical video timing */
export const VIDEO_TARGET_SECONDS = 45;
export const VIDEO_HOOK_SECONDS = 3;
export const VIDEO_OUTRO_SECONDS = 6;

/** ~3.5 chars/sec at oral pace — fits 45s with TTS +5% */
export const VIDEO_SCRIPT_CHAR_MIN = 140;
export const VIDEO_SCRIPT_CHAR_MAX = 185;

export function slideTimingsForCount(slideCount: number): number[] {
  if (slideCount <= 1) return [VIDEO_TARGET_SECONDS];
  const pointCount = Math.max(1, slideCount - 2);
  const pointSec =
    (VIDEO_TARGET_SECONDS - VIDEO_HOOK_SECONDS - VIDEO_OUTRO_SECONDS) / pointCount;
  const rounded = Math.round(pointSec * 100) / 100;
  const timings = [
    VIDEO_HOOK_SECONDS,
    ...Array.from({ length: pointCount }, () => rounded),
    VIDEO_OUTRO_SECONDS,
  ];
  const sum = timings.reduce((a, b) => a + b, 0);
  const drift = Math.round((VIDEO_TARGET_SECONDS - sum) * 100) / 100;
  timings[timings.length - 1] = Math.round((timings[timings.length - 1] + drift) * 100) / 100;
  return timings;
}
