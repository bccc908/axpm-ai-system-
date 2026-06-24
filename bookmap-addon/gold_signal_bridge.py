"""
Signal Flag → Bookmap bridge (Python API / L1 add-on skeleton)

Polls GET /api/gold-signals/bookmap from your Signal Flag server and logs alerts.
Extend with Bookmap Python API callbacks to draw on-chart markers or pop notifications.

Setup:
1. Bookmap 7.4+ → Settings → Manage plugins → install Bookmap Python API
2. Set SIGNAL_FLAG_URL and LOCAL_API_KEY below (same as .env.local)
3. Load this script from Bookmap Python add-on panel or your IDE

Docs: https://bookmap.com/knowledgebase/docs/Addons-Python-API
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

# --- config (edit or set env vars) ---
SIGNAL_FLAG_URL = os.environ.get(
    "SIGNAL_FLAG_URL", "http://localhost:3000/api/gold-signals/bookmap"
)
LOCAL_API_KEY = os.environ.get("LOCAL_API_KEY", "")
POLL_SECONDS = int(os.environ.get("GOLD_SIGNAL_POLL_SECONDS", "30"))


def fetch_latest_alert() -> dict | None:
    req = urllib.request.Request(
        SIGNAL_FLAG_URL,
        headers={"Authorization": f"Bearer {LOCAL_API_KEY}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        body = json.loads(res.read().decode("utf-8"))
    alert = body.get("alert")
    return alert if isinstance(alert, dict) else None


def format_alert(alert: dict) -> str:
    bias = alert.get("bias", "?")
    conf = alert.get("confidence", "?")
    entry = alert.get("entry")
    stop = alert.get("stop")
    targets = alert.get("targets") or []
    headline = alert.get("alert") or ""
    return (
        f"[XAUUSD {bias.upper()} {conf}%] {headline}\n"
        f"Entry: {entry} | Stop: {stop} | TP: {targets}\n"
        f"Invalidation: {alert.get('invalidation', '')}"
    )


def main_loop() -> None:
    if not LOCAL_API_KEY:
        print("Set LOCAL_API_KEY env var to match Signal Flag .env.local")
        return

    last_id: str | None = None
    print(f"Polling {SIGNAL_FLAG_URL} every {POLL_SECONDS}s …")

    while True:
        try:
            alert = fetch_latest_alert()
            if alert and alert.get("signal_id") != last_id:
                last_id = alert.get("signal_id")
                print("\n=== NEW GOLD SIGNAL ===")
                print(format_alert(alert))
                print("Bookmap playbook:")
                print(alert.get("playbook", ""))
                # TODO: hook Bookmap Python API — subscribe instrument, add alert layer
        except urllib.error.HTTPError as e:
            print(f"HTTP {e.code}: {e.reason}")
        except Exception as e:
            print(f"poll error: {e}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main_loop()
