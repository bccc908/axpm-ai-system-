import { randomBytes, randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { withFileLock, writeJsonAtomic } from "@/lib/auth/atomic-json";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isEmailVerified } from "@/lib/auth/verification";
import {
  PUBLIC_SIGNUP_ROLE,
  type AuthData,
  type AuthUser,
  type AuthUserPublic,
  type UserRole,
} from "@/lib/auth/types";

function authDataFile() {
  const override = process.env.AXPM_AUTH_USERS_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "users.json");
}

function lockPath() {
  return `${authDataFile()}.lock`;
}

async function readUsers(): Promise<AuthData> {
  try {
    const raw = await fs.readFile(authDataFile(), "utf-8");
    const parsed = JSON.parse(raw) as AuthData;
    return { users: parsed.users ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { users: [] };
    throw error;
  }
}

async function write(data: AuthData) {
  await writeJsonAtomic(authDataFile(), data);
}

async function locked<T>(fn: (data: AuthData) => Promise<T>): Promise<T> {
  return withFileLock(lockPath(), async () => fn(await readUsers()));
}

function newNonce() {
  return randomBytes(16).toString("hex");
}

export async function listUsers(): Promise<AuthUser[]> {
  const data = await readUsers();
  return data.users;
}

export async function needsSetup(): Promise<boolean> {
  const data = await readUsers();
  return data.users.length === 0;
}

export function toPublicUser(user: AuthUser): AuthUserPublic {
  return {
    id: user.id,
    email: user.email.toLowerCase(),
    name: user.name,
    role: user.role,
  };
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const data = await readUsers();
  const key = email.trim().toLowerCase();
  return data.users.find((u) => u.email.toLowerCase() === key && u.is_active) ?? null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const data = await readUsers();
  return data.users.find((u) => u.id === id && u.is_active) ?? null;
}

export async function createOwnerAccount(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthUserPublic> {
  return locked(async (data) => {
    if (data.users.length > 0) {
      throw new Error("Setup already completed");
    }
    const user: AuthUser = {
      id: randomUUID(),
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: "owner",
      password_hash: hashPassword(input.password),
      is_active: true,
      created_at: new Date().toISOString(),
      email_verified_at: new Date().toISOString(),
    };
    data.users.push(user);
    await write(data);
    return toPublicUser(user);
  });
}

export async function verifyLogin(email: string, password: string): Promise<AuthUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return user;
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}): Promise<AuthUserPublic> {
  return locked(async (data) => {
    const email = input.email.trim().toLowerCase();
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error("Email already exists");
    }
    const user: AuthUser = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      role: input.role,
      password_hash: hashPassword(input.password),
      is_active: true,
      created_at: new Date().toISOString(),
      email_verified_at: new Date().toISOString(),
    };
    data.users.push(user);
    await write(data);
    return toPublicUser(user);
  });
}

export async function findOwnerUser(): Promise<AuthUser | null> {
  const data = await readUsers();
  return data.users.find((u) => u.role === "owner" && u.is_active) ?? null;
}

export async function registerCustomer(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthUserPublic> {
  return locked(async (data) => {
    const email = input.email.trim().toLowerCase();
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error("Email already exists");
    }
    const user: AuthUser = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      role: PUBLIC_SIGNUP_ROLE,
      password_hash: hashPassword(input.password),
      is_active: true,
      created_at: new Date().toISOString(),
      email_verified_at: null,
      verify_nonce: newNonce(),
    };
    data.users.push(user);
    await write(data);
    return toPublicUser(user);
  });
}

export async function prepareVerification(
  userId: string,
  rotate: boolean,
): Promise<{ email: string; name: string; nonce: string } | null> {
  return locked(async (data) => {
    const user = data.users.find((u) => u.id === userId && u.is_active);
    if (!user || isEmailVerified(user)) return null;
    if (rotate || !user.verify_nonce) {
      user.verify_nonce = newNonce();
      await write(data);
    }
    return { email: user.email, name: user.name, nonce: user.verify_nonce };
  });
}

export async function confirmVerification(userId: string, nonce: string): Promise<boolean> {
  return locked(async (data) => {
    const user = data.users.find((u) => u.id === userId && u.is_active);
    if (!user || !nonce || user.verify_nonce !== nonce) return false;
    user.email_verified_at = new Date().toISOString();
    user.verify_nonce = null;
    await write(data);
    return true;
  });
}

export async function preparePasswordReset(
  email: string,
): Promise<{ id: string; email: string; name: string; nonce: string } | null> {
  return locked(async (data) => {
    const key = email.trim().toLowerCase();
    const user = data.users.find((u) => u.email.toLowerCase() === key && u.is_active);
    if (!user) return null;
    user.reset_nonce = newNonce();
    await write(data);
    return { id: user.id, email: user.email, name: user.name, nonce: user.reset_nonce };
  });
}

export async function confirmPasswordReset(userId: string, nonce: string, password: string): Promise<boolean> {
  return locked(async (data) => {
    const user = data.users.find((u) => u.id === userId && u.is_active);
    if (!user || !nonce || user.reset_nonce !== nonce) return false;
    user.password_hash = hashPassword(password);
    user.reset_nonce = null;
    if (!isEmailVerified(user)) user.email_verified_at = new Date().toISOString();
    await write(data);
    return true;
  });
}
