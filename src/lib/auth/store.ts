import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { PUBLIC_SIGNUP_ROLE, type AuthData, type AuthUser, type AuthUserPublic, type UserRole } from "@/lib/auth/types";

function authDataFile() {
  const override = process.env.AXPM_AUTH_USERS_PATH?.trim();
  if (override) return override;
  return path.join(process.cwd(), "data", "users.json");
}

async function ensureFile(): Promise<AuthData> {
  const dataFile = authDataFile();
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({ users: [] }, null, 2));
  }
  const raw = await fs.readFile(dataFile, "utf-8");
  const parsed = JSON.parse(raw) as AuthData;
  return { users: parsed.users ?? [] };
}

async function write(data: AuthData) {
  const dataFile = authDataFile();
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

export async function listUsers(): Promise<AuthUser[]> {
  const data = await ensureFile();
  return data.users;
}

export async function needsSetup(): Promise<boolean> {
  const data = await ensureFile();
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
  const data = await ensureFile();
  const key = email.trim().toLowerCase();
  return data.users.find((u) => u.email.toLowerCase() === key && u.is_active) ?? null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const data = await ensureFile();
  return data.users.find((u) => u.id === id && u.is_active) ?? null;
}

export async function createOwnerAccount(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthUserPublic> {
  const data = await ensureFile();
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
  };
  data.users.push(user);
  await write(data);
  return toPublicUser(user);
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
  const data = await ensureFile();
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
  };
  data.users.push(user);
  await write(data);
  return toPublicUser(user);
}

export async function findOwnerUser(): Promise<AuthUser | null> {
  const data = await ensureFile();
  return data.users.find((u) => u.role === "owner" && u.is_active) ?? null;
}

export async function registerCustomer(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthUserPublic> {
  const data = await ensureFile();
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
  };
  data.users.push(user);
  await write(data);
  return toPublicUser(user);
}
