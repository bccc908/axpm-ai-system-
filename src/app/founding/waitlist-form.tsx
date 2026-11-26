"use client";

import { useState } from "react";
import { COPY, COUNTRIES, TEAM_SIZES, type Locale } from "@/lib/founding/copy";
import { formState } from "@/lib/founding/submission";
import { RichText, type SellerValues } from "@/components/founding/rich";
import { submitFoundingWaitlist } from "./actions";

const F = COPY.form;
const input =
  "mt-1 w-full rounded-lg border border-card-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent";
const label = "block text-sm font-medium text-foreground";

function CountrySelect({
  name,
  locale,
  required,
  value,
  onChange,
  extra = [],
}: {
  name: string;
  locale: Locale;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  extra?: [string, string][];
}) {
  return (
    <select
      name={name}
      required={required}
      className={input}
      value={value}
      defaultValue={value === undefined ? "" : undefined}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid={name}
    >
      <option value="">{F.select[locale]}</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c[locale]}
        </option>
      ))}
      {extra.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function WaitlistForm({
  locale,
  collectionOpen,
  seller,
}: {
  locale: Locale;
  collectionOpen: boolean;
  seller: SellerValues;
}) {
  const [workCountry, setWorkCountry] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const state = formState({ collectionOpen, workCountry });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Preview and mainland: send nothing at all.
    if (state !== "ready") {
      setNotice(state === "region_closed" ? F.mainland[locale] : F.notOpen[locale]);
      return;
    }
    const result = await submitFoundingWaitlist(new FormData(e.currentTarget));
    setNotice(result.status === "region_closed" ? F.mainland[locale] : F.notOpen[locale]);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate data-state={state} id="waitlist">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {F.name[locale]}
          <input name="name" className={input} autoComplete="name" />
        </label>
        <label className={label}>
          {F.email[locale]}
          <input name="workEmail" type="email" className={input} autoComplete="email" />
        </label>
        <label className={label}>
          {F.role[locale]}
          <select name="role" className={input} defaultValue="">
            <option value="">{F.select[locale]}</option>
            {F.roleOptions[locale].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {F.teamSize[locale]}
          <select name="teamSize" className={input} defaultValue="">
            <option value="">{F.select[locale]}</option>
            {TEAM_SIZES.map((s) => (
              <option key={s} value={s}>
                {s.replace("-", "–")}
              </option>
            ))}
          </select>
        </label>
        <label className={`${label} sm:col-span-2`}>
          {F.workCountry[locale]}
          <CountrySelect name="workCountry" locale={locale} required value={workCountry} onChange={setWorkCountry} />
        </label>
      </div>

      {state === "region_closed" ? (
        <p role="status" data-testid="mainland-message" className="rounded-lg border border-amber-400/60 bg-amber-400/10 p-3 text-sm text-amber-200">
          {F.mainland[locale]}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {F.hqCountry[locale]}
          <CountrySelect name="hqCountry" locale={locale} extra={[["INDIVIDUAL", F.hqIndividual[locale]]]} />
        </label>
        <label className={label}>
          {F.ownerCountry[locale]}
          <CountrySelect
            name="ownerCountry"
            locale={locale}
            extra={[
              ["SAME_AS_HQ", F.ownerSame[locale]],
              ["ON_CALL", F.ownerCall[locale]],
            ]}
          />
        </label>
        <label className={label}>
          {F.whatsapp[locale]}
          <input name="whatsapp" type="tel" className={input} />
        </label>
        <label className={label}>
          {F.telegram[locale]}
          <input name="telegram" className={input} />
        </label>
        <label className={label}>
          {F.teamName[locale]}
          <input name="teamName" className={input} />
          <span className="mt-1 block text-xs text-muted">{F.teamNameHelp[locale]}</span>
        </label>
        <label className={label}>
          {F.language[locale]}
          <select name="language" className={input} defaultValue={locale}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
      </div>

      <fieldset className="space-y-3 text-sm text-foreground">
        <label className="flex gap-2">
          <input type="checkbox" name="foundingIntent" className="mt-1" />
          <span>
            <strong>{F.intentLabel[locale]}</strong> {F.intent[locale]}
          </span>
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="consent" className="mt-1" />
          <span>
            <strong>{F.consentLabel[locale]}</strong> <RichText rich={F.consent[locale]} seller={seller} locale={locale} />
          </span>
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="marketingOptIn" className="mt-1" />
          <span>
            <strong>{F.updatesLabel[locale]}</strong> {F.updates[locale]}
          </span>
        </label>
      </fieldset>

      <ul className="space-y-1 text-xs text-muted">
        <li>{F.ownerNote[locale]}</li>
        <li>{F.noCard[locale]}</li>
        <li>{F.scope[locale]}</li>
      </ul>

      <button
        type="submit"
        disabled={state !== "ready"}
        data-testid="submit"
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {state === "ready" ? F.submit[locale] : F.submitClosed[locale]}
      </button>
      {notice ? (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
