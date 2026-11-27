import type { UserRole } from "@/lib/auth/types";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/customer/types";

/** Staff list of product accounts created at /signup. */
export const PRODUCT_SIGNUPS_PATH = "/dashboard/clients";

/** Display zone for sign-up times. UTC+8, no daylight saving. */
export const PRODUCT_SIGNUP_TIMEZONE = "Asia/Kuala_Lumpur" as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Email verification is not stored on the user record in this checkout.
 * The list reports that fact instead of inventing a verified flag.
 */
export const EMAIL_VERIFICATION_NOT_BUILT = "not_built" as const;

export type EmailVerificationState = typeof EMAIL_VERIFICATION_NOT_BUILT;

export type ProductSignupUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  password_hash?: string;
};

export type ProductSignupAccount = {
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
};

export type ProductSignupRow = {
  id: string;
  name: string;
  email: string;
  signed_up_at: string;
  /** YYYY-MM-DD HH:mm in Asia/Kuala_Lumpur, or null when created_at is not a time. */
  signed_up_at_display: string | null;
  timezone: typeof PRODUCT_SIGNUP_TIMEZONE;
  email_verification: EmailVerificationState;
  plan: SubscriptionPlan | null;
  account_status: SubscriptionStatus | null;
  login_active: boolean;
};

export type ProductSignupList = {
  timezone: typeof PRODUCT_SIGNUP_TIMEZONE;
  as_of: string;
  as_of_display: string;
  email_verification: EmailVerificationState;
  counts: {
    /** Every product sign-up row, including inactive sign-ins. */
    all: number;
    last_24_hours: number;
    last_7_days: number;
    /** Sign-ups whose auth record is still active. */
    active: number;
  };
  signups: ProductSignupRow[];
};

/** Owner, admin, sales, and viewer — the roles that can already open staff CRM. */
export function canViewProductSignups(role: UserRole): boolean {
  return roleCanAccessModule(role, "crm");
}

export function isProductSignupsPath(pathname: string): boolean {
  return pathname === PRODUCT_SIGNUPS_PATH;
}

/** This page must not show the internal wordmark. Other pages are unchanged. */
export function withoutAxpmBrand(label: string): string {
  return label.replace(/AXPM/gi, "KD").replace(/ {2,}/g, " ").trim();
}

export function productSignupsForbiddenHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>403 · Kayden Chiew</title>
</head>
<body>
<main>
<p>Kayden Chiew</p>
<h1>403</h1>
<p>You do not have access to the client sign-up list.</p>
<p>无权查看客户注册名单。</p>
</main>
</body>
</html>`;
}

export function formatInKualaLumpur(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PRODUCT_SIGNUP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  let hour = pick("hour");
  const minute = pick("minute");
  if (!year || !month || !day || !hour || !minute) return null;
  if (hour === "24") hour = "00";
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function createdAtMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

/**
 * Product sign-ups only: auth users with role customer.
 * CRM contacts and waitlist rows are not accepted here.
 * Newest created_at first. Times are labeled for Asia/Kuala_Lumpur.
 */
export function buildProductSignupList(
  users: ProductSignupUser[],
  accounts: ProductSignupAccount[],
  now: Date = new Date(),
): ProductSignupList {
  const accountByUser = new Map(accounts.map((account) => [account.user_id, account]));
  const ranked = users
    .filter((user) => user.role === "customer")
    .map((user) => {
      const account = accountByUser.get(user.id);
      return {
        row: {
          id: user.id,
          name: user.name,
          email: user.email.trim().toLowerCase(),
          signed_up_at: user.created_at,
          signed_up_at_display: formatInKualaLumpur(user.created_at),
          timezone: PRODUCT_SIGNUP_TIMEZONE,
          email_verification: EMAIL_VERIFICATION_NOT_BUILT,
          plan: account?.plan ?? null,
          account_status: account?.status ?? null,
          login_active: user.is_active,
        } satisfies ProductSignupRow,
        ms: createdAtMs(user.created_at),
      };
    })
    .sort((a, b) => {
      if (a.ms !== b.ms) return b.ms - a.ms;
      return a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0;
    });

  const nowMs = now.getTime();
  const inWindow = (ms: number, windowMs: number) =>
    Number.isFinite(ms) && ms !== Number.NEGATIVE_INFINITY && ms <= nowMs && nowMs - ms <= windowMs;

  const signups = ranked.map((entry) => entry.row);
  return {
    timezone: PRODUCT_SIGNUP_TIMEZONE,
    as_of: now.toISOString(),
    as_of_display: formatInKualaLumpur(now.toISOString()) ?? now.toISOString(),
    email_verification: EMAIL_VERIFICATION_NOT_BUILT,
    counts: {
      all: signups.length,
      last_24_hours: ranked.filter((entry) => inWindow(entry.ms, DAY_MS)).length,
      last_7_days: ranked.filter((entry) => inWindow(entry.ms, WEEK_MS)).length,
      active: signups.filter((row) => row.login_active).length,
    },
    signups,
  };
}
