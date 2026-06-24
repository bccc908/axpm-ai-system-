import "server-only";

import {
  addFortuneReading,
  deleteFortuneReading,
  getFortuneAutomation,
  getFortuneProfile,
  getFortuneReadingById,
  getRecentReadingsForPrompt,
  getTopicReadingForDate,
  importFortuneReadings,
  listFortuneReadings,
  readFortuneData,
  saveFortuneAutomation,
  saveFortuneProfile,
} from "@/lib/fortune/store";
import {
  addUserFortuneReading,
  deleteUserFortuneReading,
  getUserFortuneAutomation,
  getUserFortuneProfile,
  getUserFortuneReadingById,
  getUserRecentReadingsForPrompt,
  getUserRecentDailyReadingsForPrompt,
  getUserTopicReadingForDate,
  importUserFortuneReadings,
  listUserFortuneReadings,
  readUserFortuneDataExport,
  saveUserFortuneAutomation,
  saveUserFortuneProfile,
  writeUserFortuneDataFull,
  isReadingShareUnlocked,
  unlockReadingForShare,
} from "@/lib/fortune/user-store";
import {
  getFeedbackChatSession,
  sendFeedbackChatMessage,
} from "@/lib/fortune/feedback-chat";
import {
  formatFeedbackLearningsBlock,
  getFortuneFeedbackByReadingId,
  getFortuneFeedbackForPrompt,
  listFortuneFeedbackEntries,
  upsertFortuneFeedback,
  type FortuneFeedbackInput,
} from "@/lib/fortune/feedback";
import { countFeedbackForPrompt } from "@/lib/fortune/feedback-stats";
import type { FortuneAutomation, FortuneProfile, FortuneReading, FortuneTopic } from "@/types/fortune";
import type { FortuneReadingImport } from "@/lib/fortune/import-chatgpt";
import type { UserRole } from "@/lib/auth/types";

export type FortuneScope = {
  userId: string;
  role: UserRole;
};

export function fortuneScopeForRole(userId: string, role: UserRole): FortuneScope {
  return { userId, role };
}

function isProfileEmpty(profile: FortuneProfile) {
  return !profile.name?.trim() && !profile.birth_date?.trim() && !profile.notes?.trim();
}

/** One-time: move legacy global fortune.json into the owner's private file only. */
export async function ensureOwnerFortuneMigrated(scope: FortuneScope) {
  if (scope.role !== "owner") return;

  const userData = await readUserFortuneDataExport(scope.userId);
  if (!isProfileEmpty(userData.profile) || userData.readings.length > 0) return;

  try {
    const legacy = await readFortuneData();
    if (isProfileEmpty(legacy.profile) && legacy.readings.length === 0) return;
    await writeUserFortuneDataFull(scope.userId, legacy);
  } catch {
    /* legacy file missing — fine */
  }
}

async function withMigration<T>(scope: FortuneScope, fn: () => Promise<T>) {
  await ensureOwnerFortuneMigrated(scope);
  return fn();
}

export async function getScopedFortuneProfile(scope: FortuneScope) {
  return withMigration(scope, () => getUserFortuneProfile(scope.userId));
}

export async function saveScopedFortuneProfile(scope: FortuneScope, patch: Partial<FortuneProfile>) {
  return withMigration(scope, () => saveUserFortuneProfile(scope.userId, patch));
}

export async function listScopedFortuneReadings(scope: FortuneScope, limit = 100) {
  return withMigration(scope, () => listUserFortuneReadings(scope.userId, limit));
}

export async function getScopedTopicReadingForDate(
  scope: FortuneScope,
  topic: FortuneTopic,
  dateKey: string,
) {
  return withMigration(scope, () => getUserTopicReadingForDate(scope.userId, topic, dateKey));
}

export async function getScopedFortuneReadingById(scope: FortuneScope, id: string) {
  return withMigration(scope, () => getUserFortuneReadingById(scope.userId, id));
}

export async function getScopedRecentReadingsForPrompt(scope: FortuneScope, limit = 4) {
  return withMigration(scope, () => getUserRecentReadingsForPrompt(scope.userId, limit));
}

export async function getScopedRecentDailyReadingsForPrompt(scope: FortuneScope, limit = 6) {
  return withMigration(scope, () => getUserRecentDailyReadingsForPrompt(scope.userId, limit));
}

export async function addScopedFortuneReading(
  scope: FortuneScope,
  input: Omit<FortuneReading, "id" | "created_at">,
) {
  return withMigration(scope, () => addUserFortuneReading(scope.userId, input));
}

export async function deleteScopedFortuneReading(scope: FortuneScope, id: string) {
  return withMigration(scope, () => deleteUserFortuneReading(scope.userId, id));
}

export async function importScopedFortuneReadings(scope: FortuneScope, items: FortuneReadingImport[]) {
  return withMigration(scope, () => importUserFortuneReadings(scope.userId, items));
}

export async function getScopedFortuneAutomation(scope: FortuneScope): Promise<FortuneAutomation> {
  return withMigration(scope, () => getUserFortuneAutomation(scope.userId));
}

export async function saveScopedFortuneAutomation(
  scope: FortuneScope,
  patch: Partial<FortuneAutomation>,
) {
  return withMigration(scope, () => saveUserFortuneAutomation(scope.userId, patch));
}

/** Owner daily Telegram cron — uses owner's private store only. */
export async function getOwnerFortuneScope(): Promise<FortuneScope | null> {
  const { findOwnerUser } = await import("@/lib/auth/store");
  const owner = await findOwnerUser();
  if (!owner) return null;
  const scope = fortuneScopeForRole(owner.id, owner.role);
  await ensureOwnerFortuneMigrated(scope);
  return scope;
}

export function usesOwnerAiPrompts(role: UserRole): boolean {
  return role === "owner";
}

export async function isScopedReadingShareUnlocked(scope: FortuneScope, readingId: string) {
  return isReadingShareUnlocked(scope.userId, readingId);
}

export async function unlockScopedReadingForShare(scope: FortuneScope, readingId: string) {
  return unlockReadingForShare(scope.userId, readingId);
}

export async function getScopedFortuneFeedback(scope: FortuneScope, readingId: string) {
  return getFortuneFeedbackByReadingId(scope.userId, readingId);
}

export async function listScopedFortuneFeedback(scope: FortuneScope, limit = 50) {
  return listFortuneFeedbackEntries(scope.userId, limit);
}

export async function saveScopedFortuneFeedback(
  scope: FortuneScope,
  input: FortuneFeedbackInput,
  reading: FortuneReading,
) {
  return upsertFortuneFeedback(scope.userId, input, reading);
}

export async function getScopedFortuneFeedbackForPrompt(
  scope: FortuneScope,
  locale: "en" | "zh",
) {
  return getFortuneFeedbackForPrompt(scope.userId, locale);
}

export async function getScopedFortuneFeedbackMeta(scope: FortuneScope, locale: "en" | "zh") {
  const entries = await listFortuneFeedbackEntries(scope.userId, 20);
  return {
    learnings: formatFeedbackLearningsBlock(entries, locale),
    count: countFeedbackForPrompt(entries),
  };
}

export async function getScopedFeedbackChat(scope: FortuneScope, readingId: string) {
  return getFeedbackChatSession(scope.userId, readingId);
}

export async function sendScopedFeedbackChat(
  scope: FortuneScope,
  params: {
    reading: FortuneReading;
    message: string;
    locale: "en" | "zh";
  },
) {
  return sendFeedbackChatMessage({ ...params, userId: scope.userId });
}

/* Legacy global store — cron/back-compat only, never expose via user APIs */
export {
  getFortuneProfile,
  saveFortuneProfile,
  listFortuneReadings,
  getTopicReadingForDate,
  getFortuneReadingById,
  getRecentReadingsForPrompt,
  addFortuneReading,
  deleteFortuneReading,
  importFortuneReadings,
  getFortuneAutomation,
  saveFortuneAutomation,
};
