export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.npm_lifecycle_event === "build") return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertAuthSecretConfigured } = await import("@/lib/auth/secrets");
  try {
    assertAuthSecretConfigured();
  } catch (error) {
    const message = error instanceof Error ? error.message : "AUTH_SECRET is not set";
    console.error(message);
    process.exit(1);
  }
}
