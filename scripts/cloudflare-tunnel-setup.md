# Cloudflare Tunnel — talent.kaydenchiew.com → Mac (信号旗)

Use this to test on a public URL **before** buying Hong Kong ECS.

## Prerequisites

- Domain **kaydenchiew.com** is Active on Cloudflare (same account as dashboard).
- App running locally on **http://localhost:3000** (`npm run system`).

## One-time setup

### 1. Install cloudflared (Mac)

```bash
brew install cloudflare/cloudflare/cloudflared
```

### 2. Log in to Cloudflare (opens browser)

```bash
cloudflared tunnel login
```

Pick **kaydenchiew.com** when asked which zone to authorize.

### 3. Create tunnel

```bash
cloudflared tunnel create signalqi
```

Note the tunnel **UUID** and credentials path printed (e.g. `~/.cloudflared/<uuid>.json`).

### 4. DNS — point talent.kaydenchiew.com to tunnel

```bash
cloudflared tunnel route dns signalqi talent.kaydenchiew.com
```

Or in Cloudflare dashboard → **kaydenchiew.com** → DNS → CNAME:

| Type  | Name   | Target                              | Proxy   |
|-------|--------|-------------------------------------|---------|
| CNAME | talent | `<TUNNEL-UUID>.cfargotunnel.com`    | Proxied |

### 5. Config file

Edit `~/.cloudflared/config.yml` (replace `TUNNEL-UUID`):

```yaml
tunnel: TUNNEL-UUID
credentials-file: /Users/kayden/.cloudflared/TUNNEL-UUID.json

ingress:
  - hostname: talent.kaydenchiew.com
    service: http://localhost:3000
  - service: http_status:404
```

If you use a **token** (`CLOUDFLARE_TUNNEL_TOKEN` in `.env.local`), set the public hostname in Cloudflare:

**Zero Trust** → **Networks** → **Connectors** → **signalqi** → **Public Hostname** → add or edit:

| Subdomain | Domain          | Service              |
|-----------|-----------------|----------------------|
| talent    | kaydenchiew.com | `http://localhost:3000` |

Remove or keep `ops.kaydenchiew.com` only if you still need the old URL.

### 6. Update app URL (in `.env.local`)

```bash
NEXT_PUBLIC_APP_URL=https://talent.kaydenchiew.com
WIDGET_ALLOWED_ORIGINS=https://talent.kaydenchiew.com,https://kaydenchiew.com,https://www.kaydenchiew.com
```

Then restart: `npm run system`

### 7. Cloudflare SSL

**SSL/TLS** → **Overview** → **Full** (not Flexible).  
Tunnel to localhost HTTP is OK with **Full**; use **Full (strict)** only if you add HTTPS on localhost.

---

## Every time you work

Terminal 1 — app:

```bash
cd "/Users/kayden/axpm- ai-system"
npm run system
```

Terminal 2 — tunnel:

```bash
bash scripts/start-cloudflare-tunnel.sh
```

Or one command:

```bash
npm run go-live
```

Open: **https://talent.kaydenchiew.com/dashboard**

---

## Stop

```bash
npm run system:stop
# Ctrl+C in tunnel terminal
```

---

## Later (production)

Point your production domain A record to Hong Kong ECS and move off the tunnel.
