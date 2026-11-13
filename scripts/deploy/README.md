# Zero-downtime deploy (axpm-ops)

The live droplet used to go down for about four minutes on every rebuild.
`/usr/local/sbin/axpm-rebuild.sh` stops the app, then runs `npx next build`,
which deletes `.next` before writing a new one. During that window the
process log shows `Could not find a production build`, and
`approvals-tick` records HTTP 000.

`scripts/deploy/axpm-rebuild-zdt.sh` builds into a new directory under
`/opt/axpm-releases/` while the old process keeps serving, starts Next on
port 3001 or 3002, health-checks `/login`, points Caddy at the new port,
and only then stops the old process. If `/login` is not HTTP 200, it rolls
back automatically.

On the droplet the script is installed at `/usr/local/sbin/axpm-rebuild-zdt.sh`.
Leave the old script in place until this path is the default. Always run
pm2 as `sudo -u axpm -H`, never as root.

```bash
# Rebuild the current /opt/axpm commit (no git checkout of /opt/axpm)
sudo /usr/local/sbin/axpm-rebuild-zdt.sh

# Build a different SHA already known to the repo (or fetchable from origin),
# and fast-forward /opt/axpm after a successful cutover so cron scripts match:
sudo /usr/local/sbin/axpm-rebuild-zdt.sh --update-checkout <sha>
```

Do not use `npm run build` on the server: that npm script kills port 3000.

## Layout after the first cutover

- Caddy listens on `http://:80` and `http://127.0.0.1:3000` (explicit HTTP, no auto-HTTPS) and proxies to `127.0.0.1:3001` or `:3002`.
- Cron (`approvals-tick`, `cron-tick`) can keep calling `http://127.0.0.1:3000`.
- The running app's cwd is the current release directory, with `data`, `.env.local`, and `.run` symlinked back to `/opt/axpm`.
- State is stored in `/var/lib/axpm/zdt-state`.

## Manual rollback

1. Restore `/etc/caddy/Caddyfile` from `/etc/caddy/Caddyfile.zdt-prev` (or a backup under `/root/axpm-backups/`) and run `systemctl reload caddy`.
2. If an iptables bridge is still installed: `iptables -t nat -L OUTPUT --line-numbers | grep axpm-zdt-bridge`, then delete that rule.
3. Start the previous process:
   - After a ZDT deploy: `sudo -u axpm -H pm2 start /var/lib/axpm/axpm-<old-port>/ecosystem.config.cjs && sudo -u axpm -H pm2 save`
   - Back to the pre-ZDT layout (Next bound to :3000): Caddy must **not** listen on 3000, then `sudo -u axpm -H pm2 start /opt/axpm/ecosystem.config.cjs && sudo -u axpm -H pm2 save`.

The previous release is kept at `/opt/axpm-releases/previous` when one exists.
