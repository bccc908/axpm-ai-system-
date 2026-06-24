import "server-only";

export function getGammaApiKey(): string | null {
  return process.env.GAMMA_API_KEY?.trim() || null;
}

export function getGammaApiBaseUrl(): string {
  return process.env.GAMMA_API_BASE_URL?.trim() || "https://public-api.gamma.app/v1.0";
}

export function isGammaConfigured(): boolean {
  return Boolean(getGammaApiKey());
}

export function getGammaDefaultNumCards(): number {
  const raw = Number(process.env.GAMMA_NUM_CARDS ?? "10");
  if (!Number.isFinite(raw)) return 10;
  return Math.min(20, Math.max(4, Math.round(raw)));
}
