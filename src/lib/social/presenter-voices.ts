export const EDGE_VOICES = [
  { id: "zh-CN-YunxiNeural", labelZh: "云希（男声，推荐）", labelEn: "Yunxi (male, recommended)" },
  { id: "zh-CN-YunyiNeural", labelZh: "云逸（男声）", labelEn: "Yunyi (male)" },
  { id: "zh-CN-XiaoxiaoNeural", labelZh: "晓晓（女声）", labelEn: "Xiaoxiao (female)" },
  { id: "zh-CN-XiaoyiNeural", labelZh: "晓伊（女声）", labelEn: "Xiaoyi (female)" },
] as const;

export const MAC_VOICES = [
  { id: "Meijia", labelZh: "美佳（中文女声，推荐）", labelEn: "Meijia (Chinese female)" },
  { id: "Reed", labelZh: "Reed（中文男声）", labelEn: "Reed (Chinese male)" },
  { id: "Sandy", labelZh: "Sandy（中文女声）", labelEn: "Sandy (Chinese female)" },
] as const;

export type TtsPriority = "piper" | "minimax" | "edge" | "mac" | "auto";

export const DEFAULT_EDGE_VOICE = "zh-CN-YunxiNeural";
export const DEFAULT_MAC_VOICE = "Meijia";
