import "server-only";

import { randomUUID } from "crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConfig = {
  configured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceKey: boolean;
  canImport: boolean;
  url: string | null;
};

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

  return {
    configured: Boolean(url && anonKey),
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    hasServiceKey: Boolean(serviceKey),
    canImport: Boolean(url && serviceKey),
    url,
  };
}

export function getSupabaseAdmin(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config.canImport) {
    throw new Error(
      "Supabase import requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createSupabaseClient(config.url!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export class IdMapper {
  private map = new Map<string, string>();

  resolve(id: string | null | undefined): string | null {
    if (!id) return null;
    const cached = this.map.get(id);
    if (cached) return cached;
    const resolved = isValidUuid(id) ? id : randomUUID();
    this.map.set(id, resolved);
    return resolved;
  }
}
