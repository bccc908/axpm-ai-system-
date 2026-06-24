import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type {
  FortuneAutomation,
  FortuneData,
  FortuneProfile,
  FortuneReading,
  FortuneTopic,
} from "@/types/fortune";
import { CACHEABLE_DAILY_TOPICS } from "@/lib/fortune/store";
import { ensureFortuneShareToken } from "@/lib/fortune/public-share";
import type { FortuneReadingImport } from "@/lib/fortune/import-chatgpt";

const MAX_READINGS = 500;

function userFile(userId: string) {
  return path.join(process.cwd(), "data", "user-fortune", `${userId}.json`);
}

function emptyData(): FortuneData {
  return {
    profile: {
      name: null,
      birth_date: null,
      birth_time: null,
      notes: null,
    },
    readings: [],
  };
}

async function ensureUserFile(userId: string) {
  const file = userFile(userId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(emptyData(), null, 2));
  }
}

async function readUserFortuneData(userId: string): Promise<FortuneData> {
  await ensureUserFile(userId);
  const raw = await fs.readFile(userFile(userId), "utf-8");
  const data = JSON.parse(raw) as Partial<FortuneData>;
  return {
    profile: { ...emptyData().profile, ...data.profile },
    readings: data.readings ?? [],
    daily_telegram_enabled: data.daily_telegram_enabled,
    daily_locale: data.daily_locale,
    last_daily_sent: data.last_daily_sent ?? null,
    last_daily_email_sent: data.last_daily_email_sent ?? null,
    question_telegram_enabled: data.question_telegram_enabled,
    share_unlocks: data.share_unlocks ?? [],
    feedback_entries: data.feedback_entries ?? [],
    feedback_chats: data.feedback_chats ?? {},
  };
}

async function writeUserFortuneData(userId: string, data: FortuneData) {
  await ensureUserFile(userId);
  await fs.writeFile(userFile(userId), JSON.stringify(data, null, 2));
}

export async function getUserFortuneProfile(userId: string) {
  const data = await readUserFortuneData(userId);
  return data.profile;
}

export async function saveUserFortuneProfile(userId: string, patch: Partial<FortuneProfile>) {
  const data = await readUserFortuneData(userId);
  data.profile = { ...data.profile, ...patch };
  await writeUserFortuneData(userId, data);
  return data.profile;
}

export async function getUserFortuneAutomation(userId: string): Promise<FortuneAutomation> {
  const data = await readUserFortuneData(userId);
  return {
    daily_telegram_enabled: data.daily_telegram_enabled !== false,
    question_telegram_enabled: data.question_telegram_enabled !== false,
    daily_locale: data.daily_locale === "en" ? "en" : "zh",
    last_daily_sent: data.last_daily_sent ?? null,
    last_daily_email_sent: data.last_daily_email_sent ?? null,
  };
}

export async function saveUserFortuneAutomation(
  userId: string,
  patch: Partial<FortuneAutomation>,
) {
  const data = await readUserFortuneData(userId);
  if (patch.daily_telegram_enabled !== undefined) {
    data.daily_telegram_enabled = patch.daily_telegram_enabled;
  }
  if (patch.daily_locale !== undefined) {
    data.daily_locale = patch.daily_locale;
  }
  if (patch.last_daily_sent !== undefined) {
    data.last_daily_sent = patch.last_daily_sent;
  }
  if (patch.last_daily_email_sent !== undefined) {
    data.last_daily_email_sent = patch.last_daily_email_sent;
  }
  if (patch.question_telegram_enabled !== undefined) {
    data.question_telegram_enabled = patch.question_telegram_enabled;
  }
  await writeUserFortuneData(userId, data);
  return getUserFortuneAutomation(userId);
}

export async function readUserFortuneDataExport(userId: string): Promise<FortuneData> {
  return readUserFortuneData(userId);
}

export async function writeUserFortuneDataFull(userId: string, data: FortuneData) {
  await writeUserFortuneData(userId, data);
}

export async function isReadingShareUnlocked(userId: string, readingId: string): Promise<boolean> {
  const data = await readUserFortuneData(userId);
  return (data.share_unlocks ?? []).includes(readingId);
}

export async function unlockReadingForShare(userId: string, readingId: string): Promise<boolean> {
  const data = await readUserFortuneData(userId);
  const unlocks = new Set(data.share_unlocks ?? []);
  if (unlocks.has(readingId)) return false;
  unlocks.add(readingId);
  data.share_unlocks = [...unlocks];
  await writeUserFortuneData(userId, data);
  return true;
}

export async function listUserFortuneReadings(userId: string, limit = 100) {
  const data = await readUserFortuneData(userId);
  return [...data.readings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function getUserTopicReadingForDate(
  userId: string,
  topic: FortuneTopic,
  dateKey: string,
) {
  const data = await readUserFortuneData(userId);
  return (
    data.readings.find(
      (r) =>
        r.topic === topic &&
        r.fortune_date === dateKey &&
        !r.question?.trim(),
    ) ?? null
  );
}

export async function getUserRecentReadingsForPrompt(userId: string, limit = 4) {
  const data = await readUserFortuneData(userId);
  return [...data.readings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((r) => ({
      topic: r.topic,
      title: r.title,
      summary: r.summary,
      fortune_date: r.fortune_date,
      question: r.question,
    }));
}

/** Last N daily readings with full text — for anti-repeat prompts. */
export async function getUserRecentDailyReadingsForPrompt(userId: string, limit = 6) {
  const data = await readUserFortuneData(userId);
  return [...data.readings]
    .filter((r) => r.topic === "daily" && !r.question?.trim())
    .sort((a, b) => {
      const da = a.fortune_date ?? a.created_at.slice(0, 10);
      const db = b.fortune_date ?? b.created_at.slice(0, 10);
      return db.localeCompare(da);
    })
    .slice(0, limit)
    .map((r) => ({
      topic: r.topic,
      title: r.title,
      summary: r.summary,
      fortune_date: r.fortune_date,
      question: r.question,
      reading: r.reading,
      lucky: r.lucky,
    }));
}

export async function getUserFortuneReadingById(userId: string, id: string) {
  const data = await readUserFortuneData(userId);
  return data.readings.find((r) => r.id === id) ?? null;
}

export async function addUserFortuneReading(
  userId: string,
  input: Omit<FortuneReading, "id" | "created_at">,
) {
  const data = await readUserFortuneData(userId);
  if (
    input.fortune_date &&
    CACHEABLE_DAILY_TOPICS.includes(input.topic) &&
    !input.question?.trim()
  ) {
    data.readings = data.readings.filter(
      (r) =>
        !(
          r.topic === input.topic &&
          r.fortune_date === input.fortune_date &&
          !r.question?.trim()
        ),
    );
  }
  const reading: FortuneReading = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  data.readings.unshift(reading);
  if (data.readings.length > MAX_READINGS) {
    data.readings = data.readings.slice(0, MAX_READINGS);
  }
  await writeUserFortuneData(userId, data);
  await ensureFortuneShareToken(userId, reading.id, userId);
  return reading;
}

export async function deleteUserFortuneReading(userId: string, id: string) {
  const data = await readUserFortuneData(userId);
  const before = data.readings.length;
  data.readings = data.readings.filter((r) => r.id !== id);
  if (data.readings.length === before) return false;
  await writeUserFortuneData(userId, data);
  return true;
}

function readingKey(reading: Pick<FortuneReading, "title" | "reading" | "created_at">) {
  return `${reading.title}|${reading.reading.slice(0, 80)}|${reading.created_at.slice(0, 10)}`;
}

export async function importUserFortuneReadings(userId: string, items: FortuneReadingImport[]) {
  const data = await readUserFortuneData(userId);
  const existing = new Set(data.readings.map(readingKey));
  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    const key = readingKey(item);
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    data.readings.push({
      ...item,
      id: randomUUID(),
    });
    existing.add(key);
    imported += 1;
  }

  data.readings.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (data.readings.length > MAX_READINGS) {
    data.readings = data.readings.slice(0, MAX_READINGS);
  }
  await writeUserFortuneData(userId, data);

  return { imported, skipped, total: data.readings.length };
}
