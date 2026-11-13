#!/usr/bin/env bash
# Zero-downtime rebuild for axpm-ops (single DigitalOcean droplet).
#
# Why the old /usr/local/sbin/axpm-rebuild.sh drops the site for ~4 minutes:
# it `pm2 stop`s the app, then runs `npx next build`, which deletes `.next`
# before writing a new one. Anything that starts in between (pm2, cron,
# approvals-tick) logs "Could not find a production build" and HTTP 000.
#
# This script keeps the running process on its current .next, builds into a
# new directory under /opt/axpm-releases/<sha>-<id>, starts Next on a free
# backend port (3001 or 3002), health-checks it, then points Caddy at the
# new port and only then stops the old process.
#
# After the first successful run, Caddy owns :80 and 127.0.0.1:3000, and
# Next listens on 3001/3002. Cron (approvals-tick, cron-tick) keeps hitting
# http://127.0.0.1:3000 and does not need to change. The first cutover
# uses a short-lived iptables OUTPUT REDIRECT so :3000 never goes dark
# while the old Next process is stopped and Caddy binds that port.
#
# Usage (run as root; every pm2/build command is `sudo -u axpm -H`):
#   axpm-rebuild-zdt.sh                     # rebuild current /opt/axpm HEAD
#   axpm-rebuild-zdt.sh <git-sha>           # build that SHA (fetched if needed)
#   axpm-rebuild-zdt.sh --update-checkout <sha>  # also fast-forward /opt/axpm
#                                                # after a successful cutover
#
# Does not: merge, deploy a different SHA unless you pass one, run cron-tick,
#           delete /opt/axpm/ecosystem.config.cjs or write-env.py.
# Do not use `npm run build` (that script kills port 3000). Always `npx next build`.
#
#   axpm-rebuild-zdt.sh --migrate-caddy  # one-time: split upstream into
#                                        # /etc/caddy/axpm-upstream.caddy
#
# Rollback (automatic on healthcheck failure). Manual, if needed:
#   1. Restore /etc/caddy/axpm-upstream.caddy from
#      /etc/caddy/axpm-upstream.caddy.zdt-prev (or a backup under
#      /root/axpm-backups/) and: systemctl reload caddy
#      Do not overwrite the main Caddyfile unless you are undoing --migrate-caddy.
#   2. Remove a leftover bridge, if any:
#        iptables -t nat -L OUTPUT --line-numbers | grep axpm-zdt-bridge
#        iptables -t nat -D OUTPUT ...   # same rule
#   3. Switch back to the previous release. Read /var/lib/axpm/zdt-state as
#      KEY=VALUE (do not source it) and:
#        sudo -u axpm -H pm2 start /var/lib/axpm/<old-name>/ecosystem.config.cjs
#        or, to restore the pre-ZDT layout (Next on :3000):
#          - Caddyfile should proxy :80 to 127.0.0.1:3000 only (no :3000 bind)
#          - sudo -u axpm -H pm2 start /opt/axpm/ecosystem.config.cjs
#          - sudo -u axpm -H pm2 save
set -euo pipefail

APP_USER="axpm"
APP_ROOT="/opt/axpm"
RELEASES="/opt/axpm-releases"
STATE_DIR="/var/lib/axpm"
STATE_FILE="${STATE_DIR}/zdt-state"
CADDYFILE="/etc/caddy/Caddyfile"
CADDY_UPSTREAM="/etc/caddy/axpm-upstream.caddy"
CADDY_UPSTREAM_PREV="${CADDY_UPSTREAM}.zdt-prev"
CADDY_WRITTEN=0
PUBLIC_URL="${AXPM_PUBLIC_URL:-http://127.0.0.1}"
LOCAL_URL="http://127.0.0.1:3000"
HEALTH_PATH="/login"
BACKEND_A=3001
BACKEND_B=3002
FRONT_PORT=3000
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
KEEP_RELEASES="${KEEP_RELEASES:-2}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-2}"

UPDATE_CHECKOUT=0
MIGRATE_CADDY=0
TARGET_SHA=""

usage() {
  sed -n '2,50p' "$0" | sed 's/^# \?//'
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update-checkout) UPDATE_CHECKOUT=1; shift ;;
    --migrate-caddy) MIGRATE_CADDY=1; shift ;;
    --help|-h) usage ;;
    -*)
      echo "Unknown flag: $1" >&2
      usage
      ;;
    *)
      if [[ -n "$TARGET_SHA" ]]; then
        echo "Unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_SHA="$1"
      shift
      ;;
  esac
done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (Caddy/iptables). pm2 and the build still run as ${APP_USER}." >&2
  exit 1
fi

as_axpm() {
  sudo -u "$APP_USER" -H env NODE_OPTIONS="${NODE_OPTIONS}" "$@"
}

log() { echo "=== [zdt $(date -Iseconds)] $* ==="; }

# --- state ---
# /var/lib/axpm is root:root 0755. zdt-state is root:root 0644 and is never
# sourced (it is world-readable, so we parse only allowlisted KEY=VALUE lines).
# pm2 ecosystem files live in /var/lib/axpm/<name>/ and may be axpm-owned.
CURRENT_PORT=""
CURRENT_PM2=""
CURRENT_RELEASE=""
CURRENT_SHA=""
MODE="legacy" # legacy = Next still binds :3000; proxied = Caddy binds :3000

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
  chown root:root "$STATE_DIR"
  chmod 755 "$STATE_DIR"
}

valid_backend_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && { (( 10#$1 == BACKEND_A || 10#$1 == BACKEND_B )); }
}

valid_pm2_name() {
  [[ "$1" =~ ^axpm(-[0-9]{4,5})?$ ]]
}

valid_sha() {
  [[ "$1" =~ ^[0-9a-f]{7,40}$ ]]
}

valid_mode() {
  [[ "$1" == "legacy" || "$1" == "proxied" ]]
}

# Release dirs are /opt/axpm-releases/<sha>-<utc-timestamp>. Reject anything
# that could escape that prefix (symlinks, .., extra slashes).
valid_release_path() {
  local p="$1"
  local canon
  [[ "$p" =~ ^/opt/axpm-releases/[0-9a-f]{7,40}-[0-9]{8}T[0-9]{6}Z$ ]] || return 1
  if [[ -e "$p" || -L "$p" ]]; then
    canon="$(readlink -f "$p" || true)"
    [[ -n "$canon" && "$canon" == "$RELEASES"/* ]] || return 1
  fi
  return 0
}

# Parse KEY=VALUE only. Never source this file; it is not executed.
parse_state_file() {
  local file="$1"
  local line lineno=0
  local key value
  local got_port="" got_name="" got_release="" got_sha="" got_mode=""

  if [[ -L "$file" ]]; then
    log "refusing to read ${file}: is a symlink"
    return 1
  fi
  if [[ ! -f "$file" ]]; then
    return 1
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno + 1))
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ ! "$line" =~ ^([A-Z][A-Z0-9_]*)=([A-Za-z0-9_./:+-]+)$ ]]; then
      log "invalid state line ${lineno} in ${file}"
      return 1
    fi
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case "$key" in
      BACKEND_PORT)
        valid_backend_port "$value" || { log "invalid BACKEND_PORT in state"; return 1; }
        got_port="$value"
        ;;
      PM2_NAME)
        valid_pm2_name "$value" || { log "invalid PM2_NAME in state"; return 1; }
        got_name="$value"
        ;;
      RELEASE)
        valid_release_path "$value" || { log "invalid RELEASE in state"; return 1; }
        got_release="$value"
        ;;
      SHA)
        valid_sha "$value" || { log "invalid SHA in state"; return 1; }
        got_sha="$value"
        ;;
      MODE)
        valid_mode "$value" || { log "invalid MODE in state"; return 1; }
        got_mode="$value"
        ;;
      UPDATED_AT)
        ;;
      *)
        log "unexpected key ${key} in ${file}"
        return 1
        ;;
    esac
  done < "$file"

  if [[ -z "$got_port" || -z "$got_name" || -z "$got_mode" ]]; then
    log "state file ${file} missing required keys (BACKEND_PORT, PM2_NAME, MODE)"
    return 1
  fi
  CURRENT_PORT="$got_port"
  CURRENT_PM2="$got_name"
  CURRENT_RELEASE="$got_release"
  CURRENT_SHA="$got_sha"
  MODE="$got_mode"
  return 0
}

load_state() {
  if [[ -f "$STATE_FILE" ]]; then
    parse_state_file "$STATE_FILE" || {
      log "ignoring unreadable or invalid ${STATE_FILE}"
      CURRENT_PORT=""; CURRENT_PM2=""; CURRENT_RELEASE=""; CURRENT_SHA=""; MODE="legacy"
    }
  fi
  if [[ -z "$CURRENT_PM2" ]]; then
    if as_axpm pm2 describe axpm >/dev/null 2>&1; then
      CURRENT_PM2="axpm"
      CURRENT_PORT="3000"
      CURRENT_RELEASE="$APP_ROOT"
      MODE="legacy"
    fi
  fi
}

write_state() {
  local port="$1" name="$2" release="$3" sha="$4" mode="$5"
  local tmp
  valid_backend_port "$port" || { log "refusing to write invalid BACKEND_PORT"; return 1; }
  valid_pm2_name "$name" || { log "refusing to write invalid PM2_NAME"; return 1; }
  valid_release_path "$release" || { log "refusing to write invalid RELEASE"; return 1; }
  valid_sha "$sha" || { log "refusing to write invalid SHA"; return 1; }
  valid_mode "$mode" || { log "refusing to write invalid MODE"; return 1; }
  ensure_state_dir
  tmp="$(mktemp "${STATE_DIR}/zdt-state.XXXXXX")"
  cat > "$tmp" <<EOF
BACKEND_PORT=${port}
PM2_NAME=${name}
RELEASE=${release}
SHA=${sha}
MODE=${mode}
UPDATED_AT=$(date -Iseconds)
EOF
  chmod 644 "$tmp"
  chown root:root "$tmp"
  mv "$tmp" "$STATE_FILE"
  chown root:root "$STATE_FILE"
  chmod 644 "$STATE_FILE"
}

# --- health ---
http_code() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 8 "$url" 2>/dev/null || true)"
  [[ "$code" =~ ^[0-9]{3}$ ]] || code="000"
  printf '%s
' "$code"
}

wait_healthy() {
  local url="$1"
  local label="$2"
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  local code="000"
  while (( SECONDS < deadline )); do
    code="$(http_code "$url")"
    if [[ "$code" == "200" ]]; then
      log "health ok ${label} -> 200 (${url})"
      return 0
    fi
    sleep "$HEALTH_INTERVAL"
  done
  log "health FAIL ${label} last=${code} (${url})"
  return 1
}

assert_healthy() {
  local url="$1"
  local label="$2"
  local code
  code="$(http_code "$url")"
  if [[ "$code" != "200" ]]; then
    log "health FAIL ${label} -> ${code} (${url})"
    return 1
  fi
  log "health ok ${label} -> 200 (${url})"
}

# --- caddy ---
# The main Caddyfile (site blocks, future talent.kaydenchiew.com, etc.) is
# not overwritten. This script only edits /etc/caddy/axpm-upstream.caddy.
# Run --migrate-caddy once to switch a combined Caddyfile to that layout.

caddyfile_has_upstream_import() {
  grep -qE '^[[:space:]]*import[[:space:]]+(axpm-upstream\.caddy|/etc/caddy/axpm-upstream\.caddy)[[:space:]]*$' "$CADDYFILE"
}

write_upstream_body() {
  local backend="$1"
  cat <<EOF
# Managed by axpm-rebuild-zdt.sh. Do not hand-edit the backend port.
# Imported by /etc/caddy/Caddyfile as the (axpm_backend) snippet.
(axpm_backend) {
	reverse_proxy 127.0.0.1:${backend} {
		header_up Host {host}
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto {scheme}
		header_up X-Forwarded-For {remote_host}
	}
}
EOF
}

# Validate a candidate snippet against the live Caddyfile in a temp dir
# so a bad file is never installed.
validate_upstream_snippet() {
  local snippet="$1"
  local vdir
  vdir="$(mktemp -d /tmp/axpm-caddy-validate.XXXXXX)"
  cp "$CADDYFILE" "$vdir/Caddyfile"
  cp "$snippet" "$vdir/axpm-upstream.caddy"
  if ! (cd "$vdir" && caddy validate --config "$vdir/Caddyfile") >/tmp/axpm-caddy-validate.log 2>&1; then
    log "Caddy validate failed for new axpm-upstream.caddy:"
    cat /tmp/axpm-caddy-validate.log >&2
    rm -rf "$vdir"
    return 1
  fi
  rm -rf "$vdir"
  return 0
}

# $1 = backend port (3001 or 3002). Edits only axpm-upstream.caddy.
write_upstream() {
  local backend="$1"
  local tmp
  valid_backend_port "$backend" || { log "invalid backend port ${backend}"; return 1; }
  if ! caddyfile_has_upstream_import; then
    log "Caddyfile does not import axpm-upstream.caddy; run: $0 --migrate-caddy"
    return 1
  fi
  tmp="$(mktemp /tmp/axpm-upstream.XXXXXX)"
  write_upstream_body "$backend" > "$tmp"
  if ! validate_upstream_snippet "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if [[ -f "$CADDY_UPSTREAM" ]]; then
    cp -a "$CADDY_UPSTREAM" "$CADDY_UPSTREAM_PREV"
  fi
  mv "$tmp" "$CADDY_UPSTREAM"
  chmod 644 "$CADDY_UPSTREAM"
  chown root:root "$CADDY_UPSTREAM"
  CADDY_WRITTEN=1
  if ! systemctl reload caddy; then
    log "caddy reload failed; restoring previous axpm-upstream.caddy"
    restore_caddy_prev
    return 1
  fi
  log "Caddy reloaded; upstream 127.0.0.1:${backend}"
}

restore_caddy_prev() {
  if [[ "$CADDY_WRITTEN" != "1" ]]; then
    return 0
  fi
  if [[ -f "$CADDY_UPSTREAM_PREV" ]]; then
    cp -a "$CADDY_UPSTREAM_PREV" "$CADDY_UPSTREAM"
    systemctl reload caddy || true
    CADDY_WRITTEN=0
    log "restored previous axpm-upstream.caddy"
  fi
}

caddy_adapt_fingerprint() {
  local config="$1"
  local dir
  dir="$(dirname "$config")"
  (cd "$dir" && caddy adapt --config "$config") 2>/tmp/axpm-caddy-adapt.err | python3 -c '
import json, sys
data = json.load(sys.stdin)
servers = data.get("apps", {}).get("http", {}).get("servers", {})
items = []
for s in servers.values():
    items.append({
        "listen": s.get("listen"),
        "automatic_https": s.get("automatic_https"),
        "routes": s.get("routes"),
    })
items.sort(key=lambda x: json.dumps(x["listen"], sort_keys=True))
json.dump(items, sys.stdout, sort_keys=True, separators=(",", ":"))
'
}

# One-time restructure: move the reverse_proxy target into axpm-upstream.caddy
# and leave site blocks / comments in the main Caddyfile. Aborts unless
# `caddy adapt` fingerprints of the old and new layouts match.
migrate_caddy_layout() {
  local backend="$1"
  local ts dest vdir old_fp new_fp
  ensure_state_dir
  if caddyfile_has_upstream_import && [[ -f "$CADDY_UPSTREAM" ]]; then
    log "Caddyfile already imports ${CADDY_UPSTREAM}; nothing to migrate"
    return 0
  fi
  if [[ -z "$backend" ]]; then
    if [[ -n "$CURRENT_PORT" ]] && valid_backend_port "$CURRENT_PORT"; then
      backend="$CURRENT_PORT"
    else
      log "cannot migrate Caddy: no valid backend port in state"
      return 1
    fi
  fi
  valid_backend_port "$backend" || { log "cannot migrate Caddy: invalid backend ${backend}"; return 1; }

  ts="$(date +%Y%m%dT%H%M%S)"
  dest="/root/axpm-backups/pre-caddy-import-${ts}"
  mkdir -p "$dest"
  cp -a "$CADDYFILE" "$dest/Caddyfile"
  [[ -f "$CADDY_UPSTREAM" ]] && cp -a "$CADDY_UPSTREAM" "$dest/"
  cp -a "$CADDYFILE" "${CADDYFILE}.pre-import-${ts}"
  log "backed up Caddyfile to ${dest} and ${CADDYFILE}.pre-import-${ts}"

  old_fp="$(caddy_adapt_fingerprint "$CADDYFILE")" || {
    log "caddy adapt of current Caddyfile failed"
    cat /tmp/axpm-caddy-adapt.err >&2 || true
    return 1
  }

  vdir="$(mktemp -d /tmp/axpm-caddy-migrate.XXXXXX)"
  write_upstream_body "$backend" > "$vdir/axpm-upstream.caddy"
  cat > "$vdir/Caddyfile" <<'EOF'
# Site blocks for axpm-ops. The backend port lives in axpm-upstream.caddy
# and is updated by /usr/local/sbin/axpm-rebuild-zdt.sh. Do not put
# reverse_proxy targets here.
import axpm-upstream.caddy

http://:80 {
	import axpm_backend
}

# Stable local port for cron (approvals-tick / cron-tick) and health probes.
# http:// is required: a bare 127.0.0.1:3000 site makes Caddy enable auto-HTTPS,
# after which HTTP probes and cron get "Client sent an HTTP request to an HTTPS server".
http://127.0.0.1:3000 {
	bind 127.0.0.1
	import axpm_backend
}

# After Kayden points talent.kaydenchiew.com to this droplet (DNS only / grey cloud first),
# add a site block that imports the same axpm_backend snippet (do not point it
# at 127.0.0.1:3000; Caddy itself listens on that address).
EOF

  if ! (cd "$vdir" && caddy validate --config "$vdir/Caddyfile") >/tmp/axpm-caddy-validate.log 2>&1; then
    log "migrated Caddy layout failed validate:"
    cat /tmp/axpm-caddy-validate.log >&2
    rm -rf "$vdir"
    return 1
  fi
  new_fp="$(caddy_adapt_fingerprint "$vdir/Caddyfile")" || {
    log "caddy adapt of migrated layout failed"
    cat /tmp/axpm-caddy-adapt.err >&2 || true
    rm -rf "$vdir"
    return 1
  }
  if [[ "$old_fp" != "$new_fp" ]]; then
    log "caddy adapt fingerprint mismatch; refusing to migrate (served config would change)"
    printf '%s\n' "$old_fp" > /tmp/axpm-caddy-fp-old.json
    printf '%s\n' "$new_fp" > /tmp/axpm-caddy-fp-new.json
    python3 -c 'import sys; from pathlib import Path
print("OLD:", Path("/tmp/axpm-caddy-fp-old.json").read_text()[:2000])
print("NEW:", Path("/tmp/axpm-caddy-fp-new.json").read_text()[:2000])' >&2 || true
    rm -rf "$vdir"
    return 1
  fi
  log "caddy adapt fingerprints match; installing import layout"

  cp "$vdir/axpm-upstream.caddy" "$CADDY_UPSTREAM"
  chmod 644 "$CADDY_UPSTREAM"
  chown root:root "$CADDY_UPSTREAM"
  cp "$vdir/Caddyfile" "$CADDYFILE"
  chmod 644 "$CADDYFILE"
  chown root:root "$CADDYFILE"
  rm -rf "$vdir"

  if ! systemctl reload caddy; then
    log "caddy reload after migrate failed; restoring pre-import Caddyfile"
    cp -a "${CADDYFILE}.pre-import-${ts}" "$CADDYFILE"
    rm -f "$CADDY_UPSTREAM"
    systemctl reload caddy || true
    return 1
  fi
  if ! assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after caddy migrate"; then
    log "health failed after migrate; restoring pre-import Caddyfile"
    cp -a "${CADDYFILE}.pre-import-${ts}" "$CADDYFILE"
    rm -f "$CADDY_UPSTREAM"
    systemctl reload caddy || true
    return 1
  fi
  if ! assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 after caddy migrate"; then
    log "health failed after migrate; restoring pre-import Caddyfile"
    cp -a "${CADDYFILE}.pre-import-${ts}" "$CADDYFILE"
    rm -f "$CADDY_UPSTREAM"
    systemctl reload caddy || true
    return 1
  fi
  log "Caddy import layout is live; upstream 127.0.0.1:${backend}"
}

# --- iptables bridge for the first cutover only ---
BRIDGE_TO=""
add_bridge() {
  local to="$1"
  BRIDGE_TO="$to"
  iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport "$FRONT_PORT" \
    -j REDIRECT --to-ports "$to" -m comment --comment axpm-zdt-bridge
  log "iptables bridge ${FRONT_PORT} -> ${to} installed"
}

remove_bridge() {
  local to="${1:-$BRIDGE_TO}"
  [[ -z "$to" ]] && return 0
  while iptables -t nat -C OUTPUT -p tcp -d 127.0.0.1 --dport "$FRONT_PORT" \
      -j REDIRECT --to-ports "$to" -m comment --comment axpm-zdt-bridge 2>/dev/null; do
    iptables -t nat -D OUTPUT -p tcp -d 127.0.0.1 --dport "$FRONT_PORT" \
      -j REDIRECT --to-ports "$to" -m comment --comment axpm-zdt-bridge || break
    log "iptables bridge ${FRONT_PORT} -> ${to} removed"
  done
  BRIDGE_TO=""
}

# --- pm2 ---
pm2_exists() {
  local name="$1"
  as_axpm pm2 describe "$name" >/dev/null 2>&1
}

write_ecosystem() {
  local name="$1"
  local cwd="$2"
  local port="$3"
  # PM2 only treats a file as an ecosystem config if it is named
  # ecosystem.config.js/cjs (or .json). Any other name is started as a script.
  local path="${STATE_DIR}/${name}/ecosystem.config.cjs"
  mkdir -p "$(dirname "$path")"
  cat > "$path" <<EOF
module.exports = {
  apps: [
    {
      name: ${name@Q},
      cwd: ${cwd@Q},
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p ${port}",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "${port}",
      },
    },
  ],
};
EOF
  chown "${APP_USER}:${APP_USER}" "$path"
  echo "$path"
}

# --- rollback ---
PHASE="start"
NEW_PM2=""
NEW_PORT=""
NEW_RELEASE=""
OLD_STOPPED=0

rollback() {
  local rc=$?
  if [[ "$PHASE" == "done" ]]; then
    return 0
  fi
  trap - EXIT ERR INT TERM
  log "rollback starting (phase=${PHASE}, exit=${rc})"
  set +e
  if [[ "$PHASE" == "old_stopped" || "$PHASE" == "traffic_shifted" || "$PHASE" == "proxied_pending" ]]; then
    # Prefer putting traffic back on the old process if it still exists or can be started.
    if [[ "$OLD_STOPPED" == "1" ]]; then
      remove_bridge
      # Free :3000 if we already asked Caddy to bind it
      if [[ "$MODE" == "legacy" ]]; then
        # Restore Caddy to :80 -> :3000 only, then start the original app.
        if [[ -f "$APP_ROOT/ecosystem.config.cjs" ]] && [[ -d "$APP_ROOT/.next" ]]; then
          # Write a non-binding-3000 Caddyfile first so Next can bind 3000.
          restore_caddy_prev || true
          # If prev already binds 3000 (shouldn't in legacy), write a minimal one.
          if ss -lptn | grep -q '127.0.0.1:3000'; then
            log "port 3000 still in use during rollback; not restarting legacy Next"
          else
            as_axpm pm2 start "$APP_ROOT/ecosystem.config.cjs" || as_axpm pm2 start "$CURRENT_PM2" || true
          fi
        fi
      else
        restore_caddy_prev || true
        if [[ -n "$CURRENT_PM2" ]] && ! pm2_exists "$CURRENT_PM2"; then
          local eco="${STATE_DIR}/${CURRENT_PM2}/ecosystem.config.cjs"
          if [[ -f "$eco" ]]; then
            as_axpm pm2 start "$eco" || true
          fi
        fi
      fi
    else
      restore_caddy_prev || true
      remove_bridge
    fi
  else
    restore_caddy_prev || true
    remove_bridge
  fi
  if [[ -n "$NEW_PM2" ]] && pm2_exists "$NEW_PM2"; then
    # Only delete the new process if traffic is not supposed to stay on it.
    as_axpm pm2 delete "$NEW_PM2" || true
  fi
  as_axpm pm2 save || true
  log "rollback finished; check /login before retrying"
  exit "$rc"
}

stop_mem() { :; }

# EXIT is required: `cmd || exit 1` does not fire the ERR trap.
rollback_from_trap() {
  local rc=$?
  if [[ "$PHASE" == "done" ]]; then
    return 0
  fi
  trap - EXIT ERR INT TERM
  stop_mem 2>/dev/null || true
  (exit "$rc")
  rollback
}
trap rollback_from_trap EXIT ERR INT TERM

free_mem() {
  awk '/MemAvailable:/ {printf "avail=%dMB ", $2/1024} /MemTotal:/ {printf "total=%dMB ", $2/1024}' /proc/meminfo
  awk '/SwapFree:/ {printf "swap_free=%dMB\n", $2/1024}' /proc/meminfo
}

# --- begin ---
if [[ "$MIGRATE_CADDY" == "1" ]]; then
  # Do not use the deploy rollback trap for a layout-only change.
  trap - EXIT ERR INT TERM
  log "migrating Caddyfile to import ${CADDY_UPSTREAM}"
  load_state
  migrate_caddy_layout "${CURRENT_PORT}"
  log "migrate-caddy finished"
  exit 0
fi

log "zero-downtime rebuild starting"
log "memory $(free_mem)"
load_state
log "current pm2=${CURRENT_PM2:-none} port=${CURRENT_PORT:-unknown} mode=${MODE} release=${CURRENT_RELEASE:-none}"

if [[ -z "$TARGET_SHA" ]]; then
  TARGET_SHA="$(as_axpm git -C "$APP_ROOT" rev-parse HEAD)"
fi
# Normalise to full SHA if the object is already local; otherwise fetch.
WANT_SHA="$TARGET_SHA"
if ! TARGET_SHA="$(as_axpm git -C "$APP_ROOT" rev-parse --verify "${WANT_SHA}^{commit}" 2>/dev/null)"; then
  log "SHA not local; fetching origin"
  as_axpm git -C "$APP_ROOT" fetch --quiet origin
  TARGET_SHA="$(as_axpm git -C "$APP_ROOT" rev-parse --verify "${WANT_SHA}^{commit}")"
fi
LIVE_SHA="$(as_axpm git -C "$APP_ROOT" rev-parse HEAD)"
log "target=${TARGET_SHA} live_checkout=${LIVE_SHA}"

BUILD_ID="$(date -u +%Y%m%dT%H%M%SZ)"
NEW_RELEASE="${RELEASES}/${TARGET_SHA}-${BUILD_ID}"
NEW_PORT="$BACKEND_A"
if [[ "$CURRENT_PORT" == "$BACKEND_A" ]]; then
  NEW_PORT="$BACKEND_B"
fi
# In legacy mode the live process uses 3000, so 3001 is free.
NEW_PM2="axpm-${NEW_PORT}"

if ss -lptn | grep -q "127.0.0.1:${NEW_PORT}"; then
  log "backend port ${NEW_PORT} is already in use"
  exit 1
fi

mkdir -p "$RELEASES"
chown "${APP_USER}:${APP_USER}" "$RELEASES"
ensure_state_dir

# Memory sampler for the build window
MEM_LOG="${STATE_DIR}/memory-${BUILD_ID}.log"
(
  while true; do
    echo "$(date -Iseconds) $(free_mem) $(ps -C node -o rss=,args= --sort=-rss | head -n 5 | xargs echo)" >> "$MEM_LOG"
    sleep 5
  done
) &
MEM_PID=$!
stop_mem() { [[ -n "${MEM_PID:-}" ]] && kill "$MEM_PID" 2>/dev/null || true; }
# keep the EXIT/ERR trap from above; stop_mem is called from rollback_from_trap

log "creating worktree ${NEW_RELEASE}"
as_axpm git -C "$APP_ROOT" worktree add --detach "$NEW_RELEASE" "$TARGET_SHA"

# Share runtime data / env / node_modules with the live tree when the lockfile matches.
as_axpm ln -sfn "${APP_ROOT}/.env.local" "${NEW_RELEASE}/.env.local"
as_axpm ln -sfn "${APP_ROOT}/data" "${NEW_RELEASE}/data"
as_axpm ln -sfn "${APP_ROOT}/.run" "${NEW_RELEASE}/.run"

LOCK_LIVE="${APP_ROOT}/package-lock.json"
LOCK_NEW="${NEW_RELEASE}/package-lock.json"
if [[ -f "$LOCK_LIVE" && -f "$LOCK_NEW" ]] && cmp -s "$LOCK_LIVE" "$LOCK_NEW" && [[ -d "${APP_ROOT}/node_modules" ]]; then
  as_axpm ln -sfn "${APP_ROOT}/node_modules" "${NEW_RELEASE}/node_modules"
  log "reusing ${APP_ROOT}/node_modules (package-lock unchanged)"
else
  log "package-lock differs or no node_modules; running npm ci in the release dir"
  as_axpm bash -c "cd $(printf '%q' "$NEW_RELEASE") && npm ci --omit=dev"
fi

PHASE="building"
log "building in ${NEW_RELEASE} (live process stays up) NODE_OPTIONS=${NODE_OPTIONS}"
# Never `npm run build`: package.json currently kills whatever is on port 3000.
as_axpm bash -c "cd $(printf '%q' "$NEW_RELEASE") && npx next build"
stop_mem
log "build finished; memory $(free_mem)"
if [[ -f "$MEM_LOG" ]]; then
  log "memory log ${MEM_LOG} (min available RAM / min free swap during build):"
  python3 - "$MEM_LOG" <<'PY' || true
import re, sys
min_avail = min_swap = None
n = 0
for line in open(sys.argv[1]):
    a = re.search(r"avail=([0-9.]+)MB", line)
    s = re.search(r"swap_free=([0-9.]+)MB", line)
    if a:
        n += 1
        v = float(a.group(1))
        min_avail = v if min_avail is None else min(min_avail, v)
    if s:
        v = float(s.group(1))
        min_swap = v if min_swap is None else min(min_swap, v)
print("  samples=%s min_avail=%sMB min_swap_free=%sMB" % (n, min_avail, min_swap))
PY
fi

if [[ ! -f "${NEW_RELEASE}/.next/BUILD_ID" && ! -d "${NEW_RELEASE}/.next/standalone" ]]; then
  # Next always writes BUILD_ID for a production build.
  if [[ ! -d "${NEW_RELEASE}/.next" ]]; then
    log "build produced no .next directory"
    exit 1
  fi
fi
if [[ ! -f "${NEW_RELEASE}/.next/BUILD_ID" ]]; then
  log "warning: ${NEW_RELEASE}/.next/BUILD_ID missing; continuing if server files exist"
  ls -la "${NEW_RELEASE}/.next" | head
fi

PHASE="standby_starting"
ECO="$(write_ecosystem "$NEW_PM2" "$NEW_RELEASE" "$NEW_PORT")"
log "starting ${NEW_PM2} on 127.0.0.1:${NEW_PORT} cwd=${NEW_RELEASE}"
as_axpm pm2 start "$ECO"
PHASE="standby_up"

if ! wait_healthy "http://127.0.0.1:${NEW_PORT}${HEALTH_PATH}" "standby :${NEW_PORT}"; then
  timeout 10 as_axpm pm2 logs "$NEW_PM2" --lines 40 --nostream || true
  as_axpm pm2 status || true
  exit 1
fi

# Cut over traffic.
PHASE="traffic_shifted"
if [[ "$MODE" == "legacy" ]]; then
  # Public :80 still proxies to :3000. Bridge :3000 -> new port first so both
  # public and local probes move together, while the old Next stays running
  # as the instant rollback target.
  add_bridge "$NEW_PORT"
  sleep 0.2
  assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after bridge" || exit 1
  assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 after bridge" || exit 1

  # Point Caddy :80 directly at the new backend (still do not bind :3000 yet).
  write_upstream "$NEW_PORT"
  sleep 0.2
  assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after caddy :80 flip" || exit 1
  assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 (bridge)" || exit 1

  # Stop the old process so Caddy can bind 127.0.0.1:3000. The bridge keeps
  # local :3000 and cron working in the gap.
  PHASE="old_stopped"
  if [[ -n "$CURRENT_PM2" ]] && pm2_exists "$CURRENT_PM2"; then
    log "stopping old process ${CURRENT_PM2}"
    as_axpm pm2 stop "$CURRENT_PM2" || true
    as_axpm pm2 delete "$CURRENT_PM2" || true
    OLD_STOPPED=1
  fi
  # Wait until 3000 is not bound by Next (iptables does not occupy the port).
  for _ in $(seq 1 25); do
    if ! ss -lptn | grep -q '127.0.0.1:3000'; then
      break
    fi
    sleep 0.2
  done
  if ss -lptn | grep -q '127.0.0.1:3000'; then
    log "port 3000 still bound after stopping ${CURRENT_PM2}; not binding Caddy there"
    ss -lptn | grep 3000 || true
    exit 1
  fi

  PHASE="proxied_pending"
  write_upstream "$NEW_PORT"
  sleep 0.2
  assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after caddy binds :3000" || exit 1
  assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 after caddy bind" || exit 1
  remove_bridge "$NEW_PORT"
  sleep 0.2
  assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after bridge removed" || exit 1
  assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 via caddy" || exit 1
  MODE="proxied"
else
  # Already proxied: Caddy owns :80 and :3000. Just swap the upstream.
  write_upstream "$NEW_PORT"
  sleep 0.2
  assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after upstream swap" || exit 1
  assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 after upstream swap" || exit 1

  PHASE="old_stopped"
  if [[ -n "$CURRENT_PM2" ]] && pm2_exists "$CURRENT_PM2" && [[ "$CURRENT_PM2" != "$NEW_PM2" ]]; then
    log "stopping old process ${CURRENT_PM2}"
    as_axpm pm2 stop "$CURRENT_PM2" || true
    as_axpm pm2 delete "$CURRENT_PM2" || true
    OLD_STOPPED=1
  fi
  assert_healthy "${PUBLIC_URL}${HEALTH_PATH}" "public after old stopped" || exit 1
  assert_healthy "${LOCAL_URL}${HEALTH_PATH}" "local :3000 after old stopped" || exit 1
fi

write_state "$NEW_PORT" "$NEW_PM2" "$NEW_RELEASE" "$TARGET_SHA" "proxied"
ln -sfn "$NEW_RELEASE" "${RELEASES}/current"
if [[ -n "$CURRENT_RELEASE" && "$CURRENT_RELEASE" != "$APP_ROOT" && "$CURRENT_RELEASE" != "$NEW_RELEASE" ]]; then
  ln -sfn "$CURRENT_RELEASE" "${RELEASES}/previous"
fi

as_axpm pm2 save
as_axpm pm2 status

if [[ "$UPDATE_CHECKOUT" == "1" && "$TARGET_SHA" != "$LIVE_SHA" ]]; then
  log "fast-forwarding ${APP_ROOT} to ${TARGET_SHA} (running process uses the release dir)"
  as_axpm git -C "$APP_ROOT" checkout --quiet --detach "$TARGET_SHA" || \
    as_axpm git -C "$APP_ROOT" checkout --quiet "$TARGET_SHA"
fi

# Prune old releases, keeping the current and previous worktrees.
# Never delete APP_ROOT. Never delete the live or previous release.
if [[ "$KEEP_RELEASES" -gt 0 ]]; then
  mapfile -t OLD < <(ls -1d "${RELEASES}/"*-2* 2>/dev/null | sort)
  # Keep the last KEEP_RELEASES directories plus whatever current/previous point at.
  count=${#OLD[@]}
  keep="$KEEP_RELEASES"
  if (( count > keep )); then
    for dir in "${OLD[@]:0:$((count - keep))}"; do
      [[ -z "$dir" ]] && continue
      [[ "$dir" == "$NEW_RELEASE" ]] && continue
      [[ -n "$CURRENT_RELEASE" && "$dir" == "$CURRENT_RELEASE" ]] && continue
      if [[ -L "${RELEASES}/current" ]] && [[ "$(readlink -f "${RELEASES}/current")" == "$(readlink -f "$dir")" ]]; then
        continue
      fi
      if [[ -L "${RELEASES}/previous" ]] && [[ "$(readlink -f "${RELEASES}/previous")" == "$(readlink -f "$dir")" ]]; then
        continue
      fi
      log "pruning old release ${dir}"
      as_axpm git -C "$APP_ROOT" worktree remove --force "$dir" || rm -rf "$dir"
    done
  fi
fi

PHASE="done"
trap - EXIT ERR INT TERM
log "deploy complete sha=${TARGET_SHA} pm2=${NEW_PM2} port=${NEW_PORT} release=${NEW_RELEASE}"
log "final health public=$(http_code "${PUBLIC_URL}${HEALTH_PATH}") local=$(http_code "${LOCAL_URL}${HEALTH_PATH}")"
as_axpm pm2 status
echo "=== done ==="
