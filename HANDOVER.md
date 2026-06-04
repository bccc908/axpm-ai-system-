# AXPM System — Handover & Auto-Upgrade Guide

Use this when passing the system to another person, another computer, or a cloud server.

---

## What to hand over (3 parts)

| Part | What | How |
|------|------|-----|
| **1. Code + data** | Project + CRM/clients/settings | `npm run handover:export` → sends `.tar.gz` (no secrets) |
| **2. Secrets** | API keys | Copy `.env.local` separately (WeChat, Signal, email — not in the zip) |
| **3. Instructions** | This file | Recipient follows steps below |

---

## Recipient: first-time setup

```bash
cd axpm-ai-system
npm install
cp .env.example .env.local    # paste keys from sender
npm run system                  # build + start (http://localhost:3000)
```

Open **Settings** → check DeepSeek / Telegram / integrations.

Train AI: **Reply Agent** or **AI Test** → upload docs + save prompt.

---

## Daily commands (owner)

| Command | Purpose |
|---------|---------|
| `npm run system` | Start whole system (production) |
| `npm run system:stop` | Stop server |
| `npm run cron:tick` | Run digest, email, finance, social once |
| `npm run system:upgrade` | Pull code + update + restart |
| `npm run automation:install` | Auto-run cron every day at 9:00 |

---

## Auto-upgrade (self-update)

When code is on **GitHub**:

```bash
npm run system:upgrade
```

This will:

1. `git pull` latest code  
2. `npm install`  
3. Rebuild and restart (`npm run system`)  
4. Run one automation tick  

**Weekly auto-upgrade (optional):**

```bash
npm run automation:install
```

On Linux this also adds Sunday 3:00 AM upgrade. On macOS, add manually:

```bash
crontab -e
# Add: 0 3 * * 0 cd /path/to/axpm-ai-system && bash scripts/upgrade-system.sh
```

---

## Auto-run every day (no manual work)

1. Server must be running: `npm run system` (or set it to start on boot).
2. Install scheduler: `npm run automation:install`
3. Jobs run at **9:00 AM**: Telegram digest, email, finance, social queue.

Logs: `.run/cron.log`, `.run/system.log`

---

## Cloud / 24×7 (recommended for webhooks)

Local Mac sleeps → WhatsApp/WeChat webhooks stop. For full automation:

1. Deploy to **VPS** (Alibaba Cloud, DigitalOcean, etc.) or **Vercel + separate cron**.
2. Set in `.env.local`:
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   CRON_SECRET=random-long-string
   ```
3. Webhook URLs (Meta / 企业微信):
   - WhatsApp: `https://your-domain.com/api/webhooks/whatsapp`
   - WeChat Work: `https://your-domain.com/api/webhooks/wechat-work`
4. External cron (cron-job.org) hit daily:
   - `https://your-domain.com/api/digest/daily?secret=YOUR_CRON_SECRET`
   - `https://your-domain.com/api/email/automation?secret=...`
   - `https://your-domain.com/api/finance/automation?secret=...`
   - `https://your-domain.com/api/social/publish?secret=...`

---

## Data locations (backup before handover)

| Path | Contents |
|------|----------|
| `data/crm.json` | Clients, follow-ups |
| `data/settings.json` | Auto-reply, digest hour, AI prompt |
| `data/conversations.json` | WeChat logs |
| `data/personal-*.json` | Todos, finance, assistant |
| `data/agent-knowledge/` | Uploaded training files |
| `.env.local` | **Secrets — backup securely, never commit** |

Backup command:

```bash
tar -czf axpm-backup-$(date +%Y%m%d).tar.gz data .env.local
```

---

## Checklist before you pass it

- [ ] DeepSeek key works (`Settings` or `/api/ai/status`)
- [ ] AI prompt / training docs saved
- [ ] Auto-reply toggles set in **Settings**
- [ ] Telegram test message OK
- [ ] `.env.local` copied securely to new owner
- [ ] `data/` folder included or exported
- [ ] New owner knows: `npm run system` + `npm run automation:install`

---

## Quick reference for new owner

```
Dashboard:     http://localhost:3000/dashboard
AI chat test:  http://localhost:3000/dashboard/ai-assistant/test
Settings:      http://localhost:3000/dashboard/settings
Stop:          npm run system:stop
Upgrade:       npm run system:upgrade
```

Support: see `README.md` for Telegram, WeChat, email, DeepSeek setup.
