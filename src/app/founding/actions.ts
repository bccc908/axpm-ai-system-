"use server";

import { handleFoundingSubmission, type SubmissionResult } from "@/lib/founding/submission";

/**
 * Founding waitlist submit. PREVIEW: always a no-op. Nothing is read while the gate
 * is closed, and nothing is stored, emailed or logged. See src/lib/founding/config.ts.
 */
export async function submitFoundingWaitlist(form: FormData): Promise<SubmissionResult> {
  return handleFoundingSubmission(form);
}
