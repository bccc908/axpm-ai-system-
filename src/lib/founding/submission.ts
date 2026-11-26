/**
 * Server-side handling of a founding waitlist submission.
 *
 * Preview rule: while the gate is closed this returns "not_open" WITHOUT reading
 * any field. Mainland China always returns "region_closed" and stores nothing.
 * No file, database, email, analytics or log call is made here, ever.
 */
import { waitlistGate } from "./config";
import { getFoundingWaitlistStore } from "./store";

export const MAINLAND_CHINA = "CN";

export type SubmissionResult = { status: "not_open" | "region_closed" };

type Env = Record<string, string | undefined>;

export function isMainlandChina(country: string | null | undefined): boolean {
  return (country ?? "").trim().toUpperCase() === MAINLAND_CHINA;
}

export async function handleFoundingSubmission(
  form: Pick<FormData, "get">,
  env: Env = process.env,
): Promise<SubmissionResult> {
  if (!waitlistGate(env).open) return { status: "not_open" };
  const country = form.get("workCountry");
  if (isMainlandChina(typeof country === "string" ? country : null)) {
    return { status: "region_closed" };
  }
  const store = getFoundingWaitlistStore();
  if (!store) return { status: "not_open" };
  // TODO(founding-store): validate and save to the separate AWS Malaysia store.
  return { status: "not_open" };
}

/** What the form UI should do for the current state (pure, used by the client). */
export function formState(input: { collectionOpen: boolean; workCountry: string }) {
  if (isMainlandChina(input.workCountry)) return "region_closed" as const;
  if (!input.collectionOpen) return "preview" as const;
  return "ready" as const;
}
