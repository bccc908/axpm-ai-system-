/**
 * Founding waitlist storage: INTERFACE ONLY. Nothing is implemented on purpose.
 *
 * Compliance C-W3 / brief: any future store is a SEPARATE store in AWS Malaysia
 * (ap-southeast-5), named-staff access only. It must never be the shared app
 * database, data/users.json, Supabase, or any broker system.
 *
 * TODO(founding-store): after gate C-W1 clears and Kayden approves, implement a
 * dedicated AWS Malaysia store (own account/table/bucket, own credentials),
 * record the notice version + consent timestamp per row (CRMPM W12), and add the
 * retention job (delete non-converting rows at the earlier of 12 months after
 * sign-up or 3 months after launch). Do not log field values anywhere.
 */

export type FoundingWaitlistEntry = {
  name: string;
  workEmail: string;
  role: "ib" | "broker" | "other";
  teamSize: "1" | "2-5" | "6-15" | "16+";
  workCountry: string;
  hqCountry: string;
  /** Country only (CEO decision D-d). Never a name, ID, shareholding or address. */
  ownerCountry: string | null;
  whatsapp: string | null;
  telegram: string | null;
  teamName: string | null;
  language: "en" | "zh";
  foundingIntent: true;
  consent: { noticeVersion: string; at: string };
  marketingOptIn: boolean;
};

export interface FoundingWaitlistStore {
  save(entry: FoundingWaitlistEntry): Promise<void>;
}

/** Always null today: there is no store, so nothing can be saved. */
export function getFoundingWaitlistStore(): FoundingWaitlistStore | null {
  return null;
}
