export type UserRole = "owner" | "admin" | "sales" | "finance" | "personal" | "viewer" | "customer";

/** Role assigned by public sign-up. Least privilege: overview, fortune, and account only. */
export const PUBLIC_SIGNUP_ROLE: UserRole = "customer";

export type AuthModule =
  | "overview"
  | "todos"
  | "assistant"
  | "fortune"
  | "finance"
  | "crm"
  | "conversations"
  | "reminders"
  | "email"
  | "whatsapp"
  | "automation"
  | "social"
  | "market"
  | "team"
  | "settings"
  | "account"
  | "ops"
  | "knowledge"
  | "solana";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthUserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthData {
  users: AuthUser[];
}

export interface SessionPayload {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  exp: number;
}

export const SESSION_COOKIE = "sf_session";
