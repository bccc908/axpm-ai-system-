# Founding-customer waitlist (/founding): preview rules

Copy: `Marketing-crm-waitlist-copy-v4.md` (final; LangQA and Compliance passed), in `src/lib/founding/copy.ts`.

## It stores nothing
- `FOUNDING_WAITLIST_OPEN` defaults OFF. Even when ON, `waitlistGate()` stays closed until
  `FOUNDING_CW1_CLEARED=true` (lawyer EN + BM notice live), every `FOUNDING_SELLER_*` /
  `FOUNDING_SUPPORT_EMAIL` / `FOUNDING_PRIVACY_URL` / `FOUNDING_TERMS_URL` value is filled,
  no `ph(...)` copy placeholder is left, and a separate store exists.
- There is no store: `src/lib/founding/store.ts` is an interface + TODO only. Any future store is a
  dedicated AWS Malaysia (ap-southeast-5) store, never the shared app DB / `data/users.json`.
- While closed, the client sends no request; the server action returns `not_open` without reading a field.
  No file, DB, email, analytics or log call exists in the founding code (tested).
- Mainland China (W5 = CN): message shown, submit disabled, nothing sent or stored, always.
- No card, no deposit, no Stripe. Owner/controller (W7) is a country dropdown only.
- noindex: page meta robots, global `X-Robots-Tag: noindex, nofollow, noarchive`, robots.txt disallows `/` and `/founding`.

## Strict placeholder gate (refuses go-live)
Unfilled seller values render as `<span class="ph">{{SELLER_...}}</span>`; unresolved copy renders as
`<span class="ph">[TBD: ...]</span>` / `【待定：...】`. Markers: `class="ph"`, `[TBD]`, `[URL]`, `[Year]`,
`【待定】`, `待确认`, `TODO-COPY`, `lorem`, `{{PLACEHOLDER}}`.
1. **Build**: `next.config.ts` runs `scripts/founding-preflight.mjs` in the production-build phase, so
   `next build` / `npx next build` (the zero-downtime deploy) FAILS if `FOUNDING_WAITLIST_OPEN=true`
   while C-W1, any seller value or any copy placeholder is unresolved. Flag OFF = preview build passes.
2. **Rendered HTML** (run before any deploy that opens /founding or removes noindex):
   `npm run gate:placeholders -- http://127.0.0.1:3000 /founding "/founding?lang=zh"` exits 1 on any marker
   (and on the internal brand name). It fails today, by design.
3. **Runtime**: the gate keeps the form in preview whatever the flag says.
4. **Tests**: `src/lib/founding/founding.test.ts`.
