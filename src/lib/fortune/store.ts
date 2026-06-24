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

/** Topics cached once per HK calendar day (when no question). */
export const CACHEABLE_DAILY_TOPICS: FortuneTopic[] = [
  "daily",
  "combined",
  "career",
  "wealth",
  "love",
];
import type { FortuneReadingImport } from "@/lib/fortune/import-chatgpt";

const DATA_FILE = path.join(process.cwd(), "data", "fortune.json");
const MAX_READINGS = 500;

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

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(emptyData(), null, 2));
  }
}

export async function readFortuneData(): Promise<FortuneData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const data = JSON.parse(raw) as Partial<FortuneData>;
  return {
    profile: { ...emptyData().profile, ...data.profile },
    readings: data.readings ?? [],
    daily_telegram_enabled: data.daily_telegram_enabled,
    daily_locale: data.daily_locale,
    last_daily_sent: data.last_daily_sent ?? null,
    last_daily_email_sent: data.last_daily_email_sent ?? null,
    question_telegram_enabled: data.question_telegram_enabled,
  };
}

async function writeFortuneData(data: FortuneData) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function getFortuneProfile() {
  const data = await readFortuneData();
  return data.profile;
}

export async function saveFortuneProfile(patch: Partial<FortuneProfile>) {
  const data = await readFortuneData();
  data.profile = { ...data.profile, ...patch };
  await writeFortuneData(data);
  return data.profile;
}

export async function getFortuneAutomation(): Promise<FortuneAutomation> {
  const data = await readFortuneData();
  return {
    daily_telegram_enabled: data.daily_telegram_enabled !== false,
    question_telegram_enabled: data.question_telegram_enabled !== false,
    daily_locale: data.daily_locale === "en" ? "en" : "zh",
    last_daily_sent: data.last_daily_sent ?? null,
    last_daily_email_sent: data.last_daily_email_sent ?? null,
  };
}

export async function saveFortuneAutomation(patch: Partial<FortuneAutomation>) {
  const data = await readFortuneData();
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
  await writeFortuneData(data);
  return getFortuneAutomation();
}

export async function listFortuneReadings(limit = 100) {
  const data = await readFortuneData();
  return [...data.readings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function getDailyReadingForDate(dateKey: string) {
  return getTopicReadingForDate("daily", dateKey);
}

export async function getTopicReadingForDate(topic: FortuneTopic, dateKey: string) {
  const data = await readFortuneData();
  return (
    data.readings.find(
      (r) =>
        r.topic === topic &&
        r.fortune_date === dateKey &&
        !r.question?.trim(),
    ) ?? null
  );
}

export async function getRecentReadingsForPrompt(limit = 4) {
  const data = await readFortuneData();
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

export async function getFortuneReadingById(id: string) {
  const data = await readFortuneData();
  return data.readings.find((r) => r.id === id) ?? null;
}

export async function addFortuneReading(
  input: Omit<FortuneReading, "id" | "created_at">,
) {
  const data = await readFortuneData();
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
  await writeFortuneData(data);
  return reading;
}

function readingKey(reading: Pick<FortuneReading, "title" | "reading" | "created_at">) {
  return `${reading.title}|${reading.reading.slice(0, 80)}|${reading.created_at.slice(0, 10)}`;
}

export async function importFortuneReadings(items: FortuneReadingImport[]) {
  const data = await readFortuneData();
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
  await writeFortuneData(data);

  return { imported, skipped, total: data.readings.length };
}

export async function deleteFortuneReading(id: string) {
  const data = await readFortuneData();
  const before = data.readings.length;
  data.readings = data.readings.filter((r) => r.id !== id);
  if (data.readings.length === before) return false;
  await writeFortuneData(data);
  return true;
}
