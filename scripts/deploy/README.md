# Zero-downtime deploy (axpm-ops)

The live droplet used to go down for about four minutes on every rebuild.
`/usr/local/sbin/axpm-rebuild.sh` is now a disabled stub (the old in-place
rebuild would fight Caddy for port 3000). Use
`/usr/local/sbin/axpm-rebuild-zdt.sh` instead. Always run pm2 as
`sudo -u axpm -H`, never as root.

`scripts/deploy/axpm-rebuild-zdt.sh` builds into a new directory under
`/opt/axpm-releases/` while the old process keeps serving, starts Next on
port 3001 or 3002, health-checks `/login`, points Caddy at the new port,
and only then stops the old process. If `/login` is not HTTP 200, it rolls
back automatically.

```bash
# Rebuild the current /opt/axpm commit (no git checkout of /opt/axpm)
sudo /usr/local/sbin/axpm-rebuild-zdt.sh

# Build a different SHA already known to the repo (or fetchable from origin),
# and fast-forward /opt/axpm after a successful cutover so cron scripts match:
sudo /usr/local/sbin/axpm-rebuild-zdt.sh --update-checkout <sha>

# One-time: move the backend port out of the main Caddyfile into
# /etc/caddy/axpm-upstream.caddy (refuses to apply if `caddy adapt` would
# change the served config):
sudo /usr/local/sbin/axpm-rebuild-zdt.sh --migrate-caddy
```

Do not use `npm run build` on the server: that npm script kills port 3000.
The default build heap is `NODE_OPTIONS=--max-old-space-size=3072`.

## Layout after the first cutover

- Caddy listens on `http://:80` and `http://127.0.0.1:3000` (explicit HTTP, no auto-HTTPS) and proxies to `127.0.0.1:3001` or `:3002`.
- The backend port lives in `/etc/caddy/axpm-upstream.caddy`. The deploy script edits only that file. The main Caddyfile (site blocks, future `talent.kaydenchiew.com`, etc.) is left alone.
- Cron (`approvals-tick`, `cron-tick`) can keep calling `http://127.0.0.1:3000`.
- The running app's cwd is the current release directory, with `data`, `.env.local`, and `.run` symlinked back to `/opt/axpm`.
- Deploy state is `/var/lib/axpm/zdt-state` (root:root 0644, in a root:root 0755 directory). Never `source` that file; it is KEY=VALUE and is parsed with allowlists. pm2 ecosystem files under `/var/lib/axpm/<name>/` may be axpm-owned.

## Manual rollback

1. Restore `/etc/caddy/axpm-upstream.caddy` from `/etc/caddy/axpm-upstream.caddy.zdt-prev` (or a backup under `/root/axpm-backups/`) and run `systemctl reload caddy`. Only restore the main Caddyfile if you are undoing `--migrate-caddy`.
2. If an iptables bridge is still installed: `iptables -t nat -L OUTPUT --line-numbers | grep axpm-zdt-bridge`, then delete that rule.
3. Start the previous process (read `/var/lib/axpm/zdt-state` as KEY=VALUE; do not source it):
   - After a ZDT deploy: `sudo -u axpm -H pm2 start /var/lib/axpm/axpm-<old-port>/ecosystem.config.cjs && sudo -u axpm -H pm2 save`
   - Back to the pre-ZDT layout (Next bound to :3000): Caddy must **not** listen on 3000, then `sudo -u axpm -H pm2 start /opt/axpm/ecosystem.config.cjs && sudo -u axpm -H pm2 save`.

The previous release is kept at `/opt/axpm-releases/previous` when one exists.
