export type FortuneTopic =
  | "daily"
  | "career"
  | "wealth"
  | "love"
  | "general"
  | "astro"
  | "tarot"
  | "numerology"
  | "ziwei"
  | "meihua"
  | "yijing"
  | "chenggu"
  | "mianxiang"
  | "combined"
  | "custom";

export interface FortuneLuckyElements {
  color: string | null;
  number: string | null;
  direction: string | null;
  keyword: string | null;
}

export interface FortuneProfile {
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  notes: string | null;
}

export type FortuneFeedbackRating = "accurate" | "partial" | "wrong";

export interface FortuneReadingFeedback {
  id: string;
  reading_id: string;
  reading_title: string;
  topic: FortuneTopic;
  fortune_date: string | null;
  rating: FortuneFeedbackRating;
  /** What actually happened that day */
  actual_outcome: string | null;
  /** What the reading got wrong */
  errors: string | null;
  /** How future readings should adjust */
  correction_notes: string | null;
  /** Conversation transcript for this review */
  chat_messages?: FortuneFeedbackChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface FortuneFeedbackChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface FortuneFeedbackChatSession {
  reading_id: string;
  messages: FortuneFeedbackChatMessage[];
  draft: {
    rating: FortuneFeedbackRating | null;
    actual_outcome: string | null;
    errors: string | null;
    correction_notes: string | null;
  };
  updated_at: string;
}

export interface FortuneReading {
  id: string;
  topic: FortuneTopic;
  question: string | null;
  title: string;
  reading: string;
  summary: string | null;
  lucky: FortuneLuckyElements | null;
  zodiac: string | null;
  created_at: string;
  /** YYYY-MM-DD (HK) for daily readings */
  fortune_date?: string | null;
  /** Public view token for /share/fortune/{token} */
  share_token?: string | null;
}

export interface FortuneData {
  profile: FortuneProfile;
  readings: FortuneReading[];
  /** Send daily fortune to Telegram (default true) */
  daily_telegram_enabled?: boolean;
  /** Language for daily reading + Telegram */
  daily_locale?: "en" | "zh";
  /** YYYY-MM-DD last daily Telegram send (Asia/Hong_Kong) */
  last_daily_sent?: string | null;
  /** YYYY-MM-DD last daily email send (Asia/Hong_Kong) */
  last_daily_email_sent?: string | null;
  /** Send fortune Q&A to Telegram (default true) */
  question_telegram_enabled?: boolean;
  /** Reading IDs unlocked via share before follow-up questions */
  share_unlocks?: string[];
  /** User daily accuracy feedback for prompt calibration */
  feedback_entries?: FortuneReadingFeedback[];
  /** In-progress chat sessions keyed by reading_id */
  feedback_chats?: Record<string, FortuneFeedbackChatSession>;
}

export type FortuneAutomation = {
  daily_telegram_enabled: boolean;
  /** Send Q&A / follow-up readings to Telegram (default true) */
  question_telegram_enabled: boolean;
  daily_locale: "en" | "zh";
  last_daily_sent: string | null;
  last_daily_email_sent: string | null;
};
