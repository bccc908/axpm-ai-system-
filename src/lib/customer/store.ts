import "server-only";

import fs from "fs/promises";
import path from "path";
import { randomBytes, randomUUID } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isStripeConfigured, readingsLimitForPlan } from "@/lib/customer/plans";
import type {
  CustomerAccount,
  CustomerAccountPublic,
  CustomerApiKey,
  CustomerApiKeyPublic,
  CustomerData,
  CustomerIntegrations,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/customer/types";
import { getFortuneTodayKey } from "@/lib/fortune/date";

const DATA_FILE = path.join(process.cwd(), "data", "customer-accounts.json");

function emptyIntegrations(): CustomerIntegrations {
  return {
    deepseek_api_key: null,
    deepseek_base_url: null,
    deepseek_model: null,
  };
}

function emptyAccount(userId: string, referredByUserId: string | null = null): CustomerAccount {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    plan: "free",
    status: "active",
    readings_today: 0,
    readings_date: null,
    integrations: emptyIntegrations(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    referred_by_user_id: referredByUserId,
    created_at: now,
    updated_at: now,
  };
}

async function ensureFile(): Promise<CustomerData> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ accounts: [], api_keys: [] } satisfies CustomerData, null, 2),
    );
  }
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Partial<CustomerData>;
  const accounts = (parsed.accounts ?? []).map((account) => ({
    ...account,
    referred_by_user_id: account.referred_by_user_id ?? null,
  }));
  return {
    accounts,
    api_keys: parsed.api_keys ?? [],
  };
}

async function write(data: CustomerData) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

function resetDailyUsage(account: CustomerAccount): CustomerAccount {
  const today = getFortuneTodayKey();
  if (account.readings_date === today) return account;
  return {
    ...account,
    readings_today: 0,
    readings_date: today,
  };
}

export async function getOrCreateCustomerAccount(
  userId: string,
  opts?: { referred_by_user_id?: string | null },
): Promise<CustomerAccount> {
  const data = await ensureFile();
  const index = data.accounts.findIndex((a) => a.user_id === userId);
  if (index >= 0) {
    const refreshed = resetDailyUsage(data.accounts[index]);
    if (refreshed !== data.accounts[index]) {
      data.accounts[index] = refreshed;
      await write(data);
    }
    return refreshed;
  }
  const account = emptyAccount(userId, opts?.referred_by_user_id ?? null);
  data.accounts.push(account);
  await write(data);
  return account;
}

export async function countReferrals(referrerUserId: string): Promise<number> {
  const data = await ensureFile();
  return data.accounts.filter((a) => a.referred_by_user_id === referrerUserId).length;
}

export async function getCustomerAccount(userId: string): Promise<CustomerAccount | null> {
  const data = await ensureFile();
  const account = data.accounts.find((a) => a.user_id === userId);
  return account ? resetDailyUsage(account) : null;
}

export function toPublicAccount(account: CustomerAccount, referralCount = 0): CustomerAccountPublic {
  const limit = readingsLimitForPlan(account.plan);
  const used = account.readings_today;
  return {
    user_id: account.user_id,
    plan: account.plan,
    status: account.status,
    readings_today: used,
    readings_limit: limit,
    readings_remaining: Math.max(0, limit - used),
    current_period_end: account.current_period_end,
    integrations: {
      deepseek_configured: Boolean(account.integrations.deepseek_api_key?.trim()),
      deepseek_base_url: account.integrations.deepseek_base_url,
      deepseek_model: account.integrations.deepseek_model,
    },
    stripe_enabled: isStripeConfigured(),
    referred_by_user_id: account.referred_by_user_id,
    referral_count: referralCount,
  };
}

export async function updateCustomerIntegrations(
  userId: string,
  patch: Partial<CustomerIntegrations>,
): Promise<CustomerAccount> {
  const account = await getOrCreateCustomerAccount(userId);
  const data = await ensureFile();
  const index = data.accounts.findIndex((a) => a.user_id === userId);
  const integrations: CustomerIntegrations = {
    deepseek_api_key:
      patch.deepseek_api_key !== undefined
        ? patch.deepseek_api_key
        : account.integrations.deepseek_api_key,
    deepseek_base_url:
      patch.deepseek_base_url !== undefined
        ? patch.deepseek_base_url
        : account.integrations.deepseek_base_url,
    deepseek_model:
      patch.deepseek_model !== undefined
        ? patch.deepseek_model
        : account.integrations.deepseek_model,
  };
  const updated: CustomerAccount = {
    ...account,
    integrations,
    updated_at: new Date().toISOString(),
  };
  if (index >= 0) data.accounts[index] = updated;
  else data.accounts.push(updated);
  await write(data);
  return updated;
}

export async function setCustomerSubscription(
  userId: string,
  patch: {
    plan?: SubscriptionPlan;
    status?: SubscriptionStatus;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    current_period_end?: string | null;
  },
): Promise<CustomerAccount> {
  const data = await ensureFile();
  const account = await getOrCreateCustomerAccount(userId);
  const index = data.accounts.findIndex((a) => a.user_id === userId);
  const updated: CustomerAccount = {
    ...account,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (index >= 0) data.accounts[index] = updated;
  else data.accounts.push(updated);
  await write(data);
  return updated;
}

export async function activateTrial(userId: string, days = 7): Promise<CustomerAccount> {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return setCustomerSubscription(userId, {
    plan: "pro",
    status: "trialing",
    current_period_end: end.toISOString(),
  });
}

export function isSubscriptionActive(account: CustomerAccount): boolean {
  if (account.status === "canceled" || account.status === "past_due") return false;
  if (account.current_period_end) {
    return new Date(account.current_period_end).getTime() > Date.now();
  }
  return account.status === "active" || account.status === "trialing";
}

export async function canGenerateReading(userId: string): Promise<{
  ok: boolean;
  reason?: string;
  account: CustomerAccount;
}> {
  const account = await getOrCreateCustomerAccount(userId);
  if (!isSubscriptionActive(account) && account.plan !== "free") {
    return { ok: false, reason: "Subscription inactive", account };
  }
  const limit = readingsLimitForPlan(account.plan);
  if (account.readings_today >= limit) {
    return { ok: false, reason: "Daily reading limit reached", account };
  }
  return { ok: true, account };
}

export async function recordReadingUsage(userId: string): Promise<CustomerAccount> {
  const data = await ensureFile();
  const account = await getOrCreateCustomerAccount(userId);
  const index = data.accounts.findIndex((a) => a.user_id === userId);
  const refreshed = resetDailyUsage(account);
  const updated: CustomerAccount = {
    ...refreshed,
    readings_today: refreshed.readings_today + 1,
    readings_date: getFortuneTodayKey(),
    updated_at: new Date().toISOString(),
  };
  if (index >= 0) data.accounts[index] = updated;
  else data.accounts.push(updated);
  await write(data);
  return updated;
}

function generateApiKeyRaw(): string {
  return `sf_${randomBytes(24).toString("hex")}`;
}

export async function createCustomerApiKey(
  userId: string,
  label: string,
): Promise<{ key: CustomerApiKeyPublic; secret: string }> {
  const data = await ensureFile();
  const secret = generateApiKeyRaw();
  const record: CustomerApiKey = {
    id: randomUUID(),
    user_id: userId,
    label: label.trim() || "API key",
    key_prefix: secret.slice(0, 10),
    key_hash: hashPassword(secret),
    scopes: ["fortune"],
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  data.api_keys.push(record);
  await write(data);
  return { key: toPublicApiKey(record), secret };
}

export function toPublicApiKey(key: CustomerApiKey): CustomerApiKeyPublic {
  return {
    id: key.id,
    label: key.label,
    key_prefix: key.key_prefix,
    scopes: key.scopes,
    created_at: key.created_at,
    last_used_at: key.last_used_at,
  };
}

export async function listCustomerApiKeys(userId: string): Promise<CustomerApiKeyPublic[]> {
  const data = await ensureFile();
  return data.api_keys.filter((k) => k.user_id === userId).map(toPublicApiKey);
}

export async function deleteCustomerApiKey(userId: string, keyId: string): Promise<boolean> {
  const data = await ensureFile();
  const before = data.api_keys.length;
  data.api_keys = data.api_keys.filter((k) => !(k.id === keyId && k.user_id === userId));
  if (data.api_keys.length === before) return false;
  await write(data);
  return true;
}

export async function findCustomerByApiKey(
  rawKey: string,
): Promise<{ userId: string; keyId: string } | null> {
  const data = await ensureFile();
  for (const key of data.api_keys) {
    if (verifyPassword(rawKey, key.key_hash)) {
      return { userId: key.user_id, keyId: key.id };
    }
  }
  return null;
}

export async function touchCustomerApiKey(keyId: string) {
  const data = await ensureFile();
  const index = data.api_keys.findIndex((k) => k.id === keyId);
  if (index < 0) return;
  data.api_keys[index] = {
    ...data.api_keys[index],
    last_used_at: new Date().toISOString(),
  };
  await write(data);
}

export async function findAccountByStripeCustomerId(
  stripeCustomerId: string,
): Promise<CustomerAccount | null> {
  const data = await ensureFile();
  return data.accounts.find((a) => a.stripe_customer_id === stripeCustomerId) ?? null;
}

export async function findAccountByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<CustomerAccount | null> {
  const data = await ensureFile();
  return data.accounts.find((a) => a.stripe_subscription_id === stripeSubscriptionId) ?? null;
}

export function getCustomerDeepSeekConfig(account: CustomerAccount) {
  const key = account.integrations.deepseek_api_key?.trim();
  if (!key) return null;
  return {
    apiKey: key,
    baseUrl: account.integrations.deepseek_base_url?.trim() || "https://api.deepseek.com",
    model: account.integrations.deepseek_model?.trim() || "deepseek-chat",
  };
}
