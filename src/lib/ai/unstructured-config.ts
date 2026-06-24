import "server-only";

export function getUnstructuredApiKey(): string | null {
  return process.env.UNSTRUCTURED_API_KEY?.trim() || null;
}

export function getUnstructuredApiUrl(): string {
  return (
    process.env.UNSTRUCTURED_API_URL?.trim() ||
    "https://api.unstructured.io/general/v0/general"
  );
}

export function isUnstructuredConfigured(): boolean {
  return Boolean(getUnstructuredApiKey());
}
