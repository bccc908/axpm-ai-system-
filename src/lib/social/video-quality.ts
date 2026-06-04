/** Shared ffmpeg encoding — free quality tuning (no paid APIs) */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

export const VIDEO_ENCODE = {
  preset: "medium" as const,
  crf: "18",
  crfHook: "17",
  audioBitrate: "192k",
  audioSampleRate: "44100",
};

export const SLIDE_MOTION = {
  hookZoomStep: 0.0014,
  hookMaxZoom: 1.14,
  pointZoomStep: 0.0008,
  pointMaxZoom: 1.1,
};
