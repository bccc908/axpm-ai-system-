# AXPM AI Operation System（信号旗）

AI-powered CRM, fortune reading, personal assistant, and operations platform.

**中文使用指南：** [docs/信号旗-使用指南.md](./docs/信号旗-使用指南.md)  
**公网地址：** https://talent.kaydenchiew.com/dashboard

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in API keys
npm run system               # build + start production (stable, keeps running)
```

For development with hot reload: `npm run dev` or `npm run dev:reset`.

**Stop / restart:**
```bash
npm run system:stop
npm run system
```

**Run all automation once** (digest, email, finance, social):
```bash
npm run cron:tick
```

**Auto-upgrade** (pull code + rebuild + restart):
```bash
npm run system:upgrade
```

**Hand over to someone else** — see [HANDOVER.md](./HANDOVER.md):
```bash
npm run handover:export    # package code + data (no secrets)
# Send .env.local separately
```

**Install daily auto-run** (9:00 AM digest + jobs):
```bash
npm run automation:install
```

Open [http://localhost:3000](http://localhost:3000) — redirects to the CRM dashboard.

### Go live (public URL)

```bash
npm run system      # Terminal 1 — app on :3000
npm run go-live     # Terminal 2 — https://talent.kaydenchiew.com
```

See [scripts/cloudflare-tunnel-setup.md](./scripts/cloudflare-tunnel-setup.md) and `npm run setup-talent-domain`.

**Install as app (phone / tablet):** Open in **Safari** (iPhone) or **Chrome** (Android) → tap **Install app** banner, or use browser menu **Add to Home Screen**. Opens full-screen like a native app with bottom navigation on mobile.

**Languages:** English and 中文 (Chinese) — switch via the language selector in the sidebar.

## Core Modules

| Category | Module | Route |
|----------|--------|-------|
| **Operations** | Overview, To-Do, My Assistant, Finance | `/dashboard`, `/dashboard/todos`, … |
| **AI & Fortune** | 命理运势（面相·易经·奇门·紫微·塔罗…） | `/dashboard/fortune` |
| **AI & Fortune** | Market AI (reports, PPT, competitors) | `/dashboard/market-ai` |
| **Clients** | CRM, Inbox, Reminders | `/dashboard/crm`, `/dashboard/conversations` |
| **Marketing** | Social Media, Automation | `/dashboard/social-media` |
| **Account** | Plan, Team, Settings | `/dashboard/account`, `/dashboard/settings` |

| Module | Route | Notes |
|--------|-------|-------|
| Operations Overview | `/dashboard` | Live CRM + personal snapshot |
| **My Assistant** | `/dashboard/my-assistant` | Jobs, work log, daily planning |
| **Personal Finance** | `/dashboard/finance` | Income, expenses (MYR/CNY), payment reminders |
| **Fortune / 命理** | `/dashboard/fortune` | Face reading, I Ching, Qimen, Zi Wei, share links |
| **Market AI** | `/dashboard/market-ai` | Document analysis, charts, PPT |
| Client Database | `/dashboard/clients` | Full CRUD + auto-create from chats |
| **CRM** | `/dashboard/crm` | Leads, pipeline, reports |
| **Inbox** | `/dashboard/conversations` | Paste/import, AI reply agent |
| Reminders | `/dashboard/reminders` | Due clients, Telegram/WhatsApp |
| AI Automation | `/dashboard/automation` | Lead analysis + daily report |
| **Social Media** | `/dashboard/social-media` | Facebook, presenter video pipeline |
| **Settings** | `/dashboard/settings` | Integrations, email, backup |

**Public fortune share:** `https://talent.kaydenchiew.com/share/fortune/{token}` (no login required).

**Voice input:** Tap the mic icon on text fields (My Assistant, Finance, Clients, AI Assistant) to speak instead of typing. Uses browser speech recognition (English / 中文). If unavailable, falls back to OpenAI Whisper when `OPENAI_API_KEY` is set.

## Data Storage

All modules persist to local JSON files (no database required for development):

| File | Module |
|------|--------|
| `data/crm.json` | Clients, follow-ups, tasks, reminders, daily reports |
| `data/personal-assistant.json` | Jobs, work logs, plans |
| `data/personal-finance.json` | Transactions, payment reminders |
| `data/settings.json` | Digest hour, preferences |
| `data/conversations.json` | WeChat conversation messages |
| `data/social-posts.json` | Social media posts queue |
| `data/receipts/` | Receipt image files (Google Drive backup) |
| `data/fortune-*.json` | Fortune profiles & readings (per user) |
| `data/fortune-public-shares/` | Public share link index |

Files are auto-created on first API call with seed data from `src/lib/mock-data.ts`.

## Technology Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS 4**
- **Supabase** — optional (schema in `supabase/migrations/`, not required for local use)
- **OpenAI** — reply suggestions, summaries, lead analysis, daily reports
- **Telegram Bot API** — team reminders & daily digest
- **WhatsApp Cloud API** — client reminders & webhooks

## Environment Variables

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (optional) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (optional) |
| `OPENAI_API_KEY` | OpenAI (optional if using DeepSeek) |
| `AI_PROVIDER` | `deepseek` \| `openai` \| `auto` (auto uses DeepSeek when `DEEPSEEK_API_KEY` is set) |
| `DEEPSEEK_API_KEY` | [DeepSeek](https://platform.deepseek.com) — works well in China, no VPN |
| `DEEPSEEK_BASE_URL` | Default `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Default `deepseek-chat` |
| `OPENCLAW_GATEWAY_URL` | Local OpenClaw gateway (default `http://127.0.0.1:18789`) |
| `OPENCLAW_GATEWAY_TOKEN` | Bearer token from `~/.openclaw/openclaw.json` |
| `OPENCLAW_MODEL` | Model id (default `openclaw/default`) |
| `AI_REPLY_PROVIDER` | `auto` \| `openclaw` \| `openai` — which engine generates replies |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) (`/newbot`) |
| `TELEGRAM_CHAT_ID` | Your chat ID (see Reminders page after messaging the bot) |
| `CRON_SECRET` | Protect cron endpoints (`/api/digest/daily`, `/api/email/automation`) |
| `EMAIL_SMTP_USER` | SMTP login (QQ/163/Gmail/Outlook email) |
| `EMAIL_SMTP_PASS` | SMTP password or authorization code |
| `EMAIL_FROM` | From address (defaults to SMTP user) |
| `EMAIL_RECIPIENTS` | Fallback recipients (comma-separated) |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp sender ID |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification |

### Connect Telegram

1. In Telegram, open **@BotFather** → send `/newbot` → copy the **token**.
2. Create `.env.local` in the project root (copy from `.env.example`).
3. Add `TELEGRAM_BOT_TOKEN=...` and restart `npm run dev`.
4. Open your new bot in Telegram and send `/start` (or any message).
5. Go to **Reminders** in the dashboard → **Telegram Connection** → **Refresh** → copy the **Chat ID**.
6. Add `TELEGRAM_CHAT_ID=...` to `.env.local` and restart `npm run dev`.
7. Click **Send test message** — you should receive it in Telegram.

### Daily digest (optional cron)

Send a combined summary (jobs, plan, MYR/CNY finance, payment reminders, CRM stats) to Telegram:

```bash
curl -X POST http://localhost:3000/api/digest/daily
```

For automated scheduling, set `CRON_SECRET` in `.env.local` and call:

```bash
curl "http://localhost:3000/api/digest/daily?secret=YOUR_CRON_SECRET"
```

Or use a cron service (e.g. cron-job.org) to hit that URL every morning.

### DeepSeek (China-friendly AI)

If OpenAI is blocked or slow in China, use **DeepSeek** instead (same features: replies, receipts, lead analysis):

1. Register at [platform.deepseek.com](https://platform.deepseek.com) and create an API key.
2. Add to `.env.local`:

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-chat
```

3. Restart: `npm run dev:reset`
4. Test on **Reply Agent** → **重新检测连接** — should show DeepSeek connected.

You can leave `OPENAI_API_KEY` empty. Voice Whisper still needs OpenAI if you use mic transcription.

### DeepSeek API routes (dedicated)

These endpoints always use `DEEPSEEK_API_KEY` (Malaysia / China / anywhere):

| Method | URL | Purpose |
|--------|-----|---------|
| GET/POST | `/api/ai/deepseek/status` | Check DeepSeek connection |
| POST | `/api/ai/deepseek/chat` | General chat `{ "message": "Hello" }` |
| POST | `/api/ai/deepseek/reply` | Customer reply (same body as `/api/ai/reply`) |

Example — test chat:

```bash
curl -X POST http://localhost:3000/api/ai/deepseek/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，介绍一下AXPM"}'
```

Example — customer reply:

```bash
curl -X POST http://localhost:3000/api/ai/deepseek/reply \
  -H "Content-Type: application/json" \
  -d '{"channel":"whatsapp","clientName":"Ali","customerQuestion":"怎么入金？"}'
```

### Auto Email (China + Malaysia)

Configure SMTP in **Settings → Auto Email System**:

| Region | Recommended providers |
|--------|----------------------|
| **China** | QQ Mail, 163, 126, Aliyun Enterprise |
| **Malaysia** | Gmail, Outlook / Microsoft 365 |

Add to `.env.local`:

```bash
EMAIL_SMTP_USER=your-email@qq.com
EMAIL_SMTP_PASS=your-authorization-code   # NOT your login password for QQ/163
EMAIL_RECIPIENTS=you@example.com,team@example.com
```

**China note:** Use SMTP authorization codes from QQ/163 mail settings. Gmail may be slow or blocked from mainland China — prefer QQ or 163 for China team.

**Malaysia note:** Gmail and Outlook work reliably. Use Google App Password if 2FA is enabled.

Automatic emails (when enabled):
- Daily digest (jobs + finance) — same hour as Telegram digest
- Payment reminders — when payments are due soon
- Client follow-ups — when clients are due today

Cron endpoint for all auto emails:

```bash
curl "http://localhost:3000/api/email/automation?secret=YOUR_CRON_SECRET"
```

### Social Media Auto-Post

Open **Social Media** in the sidebar (`/dashboard/social-media`).

| Platform | Env vars | Notes |
|----------|----------|-------|
| **Facebook** | `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN` | Requires Facebook Page |
| **Instagram** | + `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Business account linked to Page; image URL required |
| **WeChat 公众号** | `WECHAT_OA_APP_ID`, `WECHAT_OA_APP_SECRET` | Publishes 图文 articles |
| **TikTok / 微博 / 抖音** | `TIKTOK_ACCESS_TOKEN`, etc. | Queue supported; API after developer approval |

Schedule posts with datetime picker, or **Publish now**. Cron for scheduled posts:

```bash
curl "http://localhost:3000/api/social/publish?secret=YOUR_CRON_SECRET"
```

### WeChat Work 企业微信 (Chat + Send)

**WeChat Logs** (`/dashboard/conversations`) — record chats and **reply to clients** from the dashboard.

Add to `.env.local`:

```bash
WECHAT_WORK_CORP_ID=           # 企业 ID
WECHAT_WORK_SECRET=            # 客户联系 Secret（或应用 Secret）
WECHAT_WORK_TOKEN=             # 回调 Token
WECHAT_WORK_SENDER_USERID=     # 成员 UserID（拥有该客户的员工账号）
```

1. **Receive messages:** Set webhook URL in 企业微信 admin → `https://your-domain.com/api/webhooks/wechat-work`
2. **Send messages:** In **Clients**, set WeChat field to client's `external_userid` (starts with `wo`)
3. **Reply:** WeChat Logs → **Send via WeChat Work** box, or **Reminders** → 发送给客户
4. **Auto client:** First message from a new contact → CRM client created automatically (tag `auto-chat`)

### OpenClaw AI — Full auto-reply

Use [OpenClaw](https://docs.openclaw.ai/) as the AI engine when OpenAI is blocked, or for a local agent with tools. AXPM can **automatically reply** on WhatsApp and WeChat Work when a customer messages you.

**1. Install and start OpenClaw**

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
openclaw gateway restart
```

**2. Copy gateway token** from `~/.openclaw/openclaw.json` into `.env.local`:

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your_gateway_token_here
AI_REPLY_PROVIDER=auto   # uses OpenClaw when token is set; falls back to OpenAI
```

**3. Enable in AXPM:** **Settings** → **OpenClaw AI auto-reply** → turn on **Enable full auto-reply** → save.

**4. Webhooks** must be configured (WhatsApp Meta webhook, WeChat Work callback) so inbound messages reach AXPM.

Flow: customer message → webhook → CRM + conversation log → AI reply (OpenClaw or OpenAI + training docs) → sent back on same channel.

Test connection: **Reply Agent** → **重新检测连接** (checks OpenAI + OpenClaw).

### Auto-record clients (no manual entry)

| Source | What happens |
|--------|----------------|
| **WeChat Work webhook** | Inbound message → client + chat saved |
| **WhatsApp webhook** | `POST /api/webhooks/whatsapp` → client matched by phone |
| **Inbound chat log** | Quick log / import without client → auto-create if enabled |
| **Registration link** | `https://your-domain.com/register` → client with tag `register` |

- Copy the link from **Clients** or **Settings**
- Toggle in **Settings → Auto-create clients**
- Optional **Telegram alert** when a new client is created

WhatsApp webhook URL: `https://your-domain.com/api/webhooks/whatsapp` (same `WHATSAPP_VERIFY_TOKEN` as Meta console).

### Finance Receipt Capture (Resit)

**Finance** → **Receipts / Resit** tab (`/dashboard/finance`):

- **Camera or upload** — snap a resit photo on phone or upload from gallery
- **AI auto-scan** — reads merchant, amount, date, category (needs `OPENAI_API_KEY`)
- **Auto expense** — optionally creates an expense record from the scan
- **Google Drive backup** — uploads each receipt to your Drive folder

Add to `.env.local`:

```bash
OPENAI_API_KEY=                    # for receipt OCR / auto-capture
GOOGLE_SERVICE_ACCOUNT_JSON=       # full JSON from Google Cloud service account
GOOGLE_DRIVE_RECEIPTS_FOLDER_ID=   # Drive folder ID (share folder with service account email)
```

**Google Drive setup:**
1. [Google Cloud Console](https://console.cloud.google.com) → create project → enable **Google Drive API**
2. Create **Service Account** → download JSON key → paste as `GOOGLE_SERVICE_ACCOUNT_JSON`
3. In Google Drive, create a folder (e.g. "AXPM Receipts") → **Share** with the service account email (Editor)
4. Copy folder ID from URL: `drive.google.com/drive/folders/FOLDER_ID_HERE`

## Database Setup (Optional — Supabase)

Run the migration in your Supabase SQL editor when ready for production:

```
supabase/migrations/001_initial_schema.sql
```

Tables: `clients`, `follow_ups`, `team_members`, `reminders`, `team_tasks`, `conversation_summaries`, `daily_reports`

## API Routes

### CRM

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clients` | GET/POST | List & create clients |
| `/api/clients/[id]` | PATCH/DELETE | Update & delete client |
| `/api/crm/overview` | GET | Dashboard stats & due clients |
| `/api/crm/reminders` | GET | Scheduled CRM reminders |
| `/api/crm/daily-report` | POST | Generate & save AI daily report |
| `/api/tasks` | GET/POST | Team tasks |
| `/api/tasks/[id]` | PATCH/DELETE | Update & delete task |
| `/api/team` | GET | Team members + follow-ups |
| `/api/settings` | GET/PATCH | App settings & integration status |

### Personal & Finance

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/digest/daily` | GET/POST | Full daily digest to Telegram |
| `/api/personal/jobs` | GET/POST | List & create personal jobs |
| `/api/personal/jobs/[id]` | PATCH/DELETE | Update & delete job |
| `/api/personal/logs` | GET/POST | Work log entries |
| `/api/personal/logs/[id]` | PATCH/DELETE | Update & delete log |
| `/api/personal/plans` | GET/POST | Daily/weekly plans |
| `/api/personal/plans/[id]` | PATCH/DELETE | Update & delete plan |
| `/api/personal/summary` | POST | Send plan + jobs summary to Telegram |
| `/api/finance/transactions` | GET/POST | Income & expense records |
| `/api/finance/transactions/[id]` | PATCH/DELETE | Update & delete transaction |
| `/api/finance/payments` | GET/POST | Credit card / bank payment reminders |
| `/api/finance/payments/[id]` | PATCH/DELETE | Update, mark paid, delete |
| `/api/finance/overview` | GET | Monthly stats & upcoming payments |
| `/api/finance/notify` | POST | Send payment reminder to Telegram |

### AI & Integrations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/email/status` | GET | Email config status + recent log |
| `/api/email/settings` | PATCH | Save email preferences (provider, recipients, auto toggles) |
| `/api/email/test` | POST | Send test email |
| `/api/email/send-digest` | GET/POST | Send daily digest via email |
| `/api/email/automation` | GET/POST | Run all auto emails (cron) |
| `/api/ai/reply` | POST | Generate WhatsApp/WeChat reply suggestions |
| `/api/ai/summarize` | POST | Summarize conversation + recommendations |
| `/api/ai/analyze-lead` | POST | AI lead scoring and tagging |
| `/api/ai/daily-report` | POST | Generate daily operations report (raw) |
| `/api/telegram/status` | GET | Bot connection status + chat IDs |
| `/api/telegram/test` | POST | Send Telegram test message |
| `/api/telegram/sync` | POST | Sync Telegram chat IDs |
| `/api/reminders/send` | POST | Send Telegram/WhatsApp reminder |
| `/api/social/posts` | GET/POST | List & create social posts |
| `/api/social/posts/[id]` | GET/DELETE | Get or delete post |
| `/api/social/publish` | GET/POST | Publish now or run scheduled posts (cron) |
| `/api/social/draft` | POST | AI-generated post draft |
| `/api/voice/transcribe` | POST | Speech-to-text via OpenAI Whisper (fallback) |
| `/api/webhooks/whatsapp` | GET/POST | WhatsApp webhook verification & intake |

## Project Structure

```
data/                            # Local JSON persistence
src/
├── app/
│   ├── (dashboard)/dashboard/   # All dashboard pages
│   └── api/                     # REST API routes
├── components/
│   ├── crm/                     # Clients, team, automation, reminders
│   ├── personal/                # My Assistant
│   ├── finance/                 # Personal Finance
│   ├── settings/                # Settings dashboard
│   └── dashboard/               # Overview + live stats
├── lib/
│   ├── crm/                     # CRM file store
│   ├── fortune/                 # Fortune, face reading, hexagram, qimen
│   ├── personal/                # Assistant file store
│   ├── finance/                 # Finance file store
│   ├── digest/                  # Daily digest builder
│   ├── ai/                      # DeepSeek / OpenAI integration
│   ├── integrations/            # Telegram, WhatsApp
│   └── i18n/                    # English + 中文
docs/
├── 信号旗-使用指南.md           # Chinese quick reference (talent domain, fortune, go-live)
scripts/
├── go-live.sh                   # App + Cloudflare tunnel
├── cloudflare-tunnel-setup.md   # talent.kaydenchiew.com setup
└── setup-talent-domain.sh       # Domain env helper
└── types/                       # TypeScript types
supabase/migrations/             # SQL schema (optional)
```

## Troubleshooting

**Internal Server Error on localhost:** Clear the Next.js cache and restart:

```bash
lsof -tiTCP:3000 | xargs kill -9
rm -rf .next
npm run dev
```

## Future Expansion

- IB management
- PAMM tracking
- Trading signal integration
- China team workflow
- Supabase Auth + RLS policies
- Real-time WhatsApp/WeChat message sync
