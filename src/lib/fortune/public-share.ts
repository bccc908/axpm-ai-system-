import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import type { FortuneReading, FortuneTopic } from "@/types/fortune";
import { brandName } from "@/lib/brand";
import { appPublicUrl, buildCustomerSignupUrl } from "@/lib/referral";
import { getUserFortuneReadingById, readUserFortuneDataExport, writeUserFortuneDataFull } from "@/lib/fortune/user-store";

type ShareIndexEntry = {
  userId: string;
  readingId: string;
  referrerUserId?: string;
};

type ShareIndex = Record<string, ShareIndexEntry>;

const INDEX_DIR = path.join(process.cwd(), "data", "fortune-public-shares");
const INDEX_FILE = path.join(INDEX_DIR, "index.json");

function newShareToken() {
  return randomBytes(9).toString("base64url");
}

export function buildPublicFortuneShareUrl(token: string) {
  return `${appPublicUrl()}/share/fortune/${token}`;
}

async function readIndex(): Promise<ShareIndex> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(raw) as ShareIndex;
  } catch {
    return {};
  }
}

async function writeIndex(index: ShareIndex) {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function persistReadingShareToken(userId: string, readingId: string, token: string) {
  const data = await readUserFortuneDataExport(userId);
  const reading = data.readings.find((r) => r.id === readingId);
  if (!reading || reading.share_token === token) return;
  reading.share_token = token;
  await writeUserFortuneDataFull(userId, data);
}

/** Ensure a reading has a public share token registered in the index. */
export async function ensureFortuneShareToken(
  userId: string,
  readingId: string,
  referrerUserId?: string | null,
): Promise<string | null> {
  const reading = await getUserFortuneReadingById(userId, readingId);
  if (!reading) return null;

  const index = await readIndex();
  if (reading.share_token && index[reading.share_token]) {
    return reading.share_token;
  }

  const token = reading.share_token || newShareToken();
  index[token] = {
    userId,
    readingId,
    referrerUserId: referrerUserId ?? userId,
  };
  await writeIndex(index);
  await persistReadingShareToken(userId, readingId, token);
  return token;
}

export type PublicFortuneShareView = {
  token: string;
  viewUrl: string;
  signupUrl: string;
  brand: string;
  locale: "zh" | "en";
  topic: FortuneTopic;
  title: string;
  summary: string | null;
  reading: string;
  lucky: FortuneReading["lucky"];
  zodiac: string | null;
  created_at: string;
};

const topicLabels: Record<FortuneTopic, { zh: string; en: string }> = {
  daily: { zh: "今日运势", en: "Daily fortune" },
  career: { zh: "事业运", en: "Career" },
  wealth: { zh: "财运", en: "Wealth" },
  love: { zh: "感情运", en: "Love" },
  general: { zh: "综合运势", en: "General" },
  astro: { zh: "星座运势", en: "Astrology" },
  tarot: { zh: "塔罗占卜", en: "Tarot" },
  numerology: { zh: "数字命理", en: "Numerology" },
  ziwei: { zh: "紫微斗数", en: "Zi Wei" },
  meihua: { zh: "梅花易数", en: "Plum Blossom" },
  yijing: { zh: "易经", en: "I Ching" },
  chenggu: { zh: "称骨算命", en: "Bone weight" },
  mianxiang: { zh: "面相分析", en: "Face reading" },
  combined: { zh: "多维综合", en: "Combined" },
  custom: { zh: "个人问事", en: "Custom" },
};

export function fortuneTopicLabel(topic: FortuneTopic, locale: "zh" | "en") {
  return topicLabels[topic][locale];
}

export async function getPublicFortuneShareByToken(
  token: string,
  locale: "zh" | "en" = "zh",
): Promise<PublicFortuneShareView | null> {
  const index = await readIndex();
  const entry = index[token];
  if (!entry) return null;

  const reading = await getUserFortuneReadingById(entry.userId, entry.readingId);
  if (!reading) return null;

  const referrer = entry.referrerUserId ?? entry.userId;
  const signupUrl = buildCustomerSignupUrl(referrer, locale);

  return {
    token,
    viewUrl: buildPublicFortuneShareUrl(token),
    signupUrl,
    brand: brandName(locale),
    locale,
    topic: reading.topic,
    title: reading.title,
    summary: reading.summary,
    reading: reading.reading,
    lucky: reading.lucky,
    zodiac: reading.zodiac,
    created_at: reading.created_at,
  };
}
