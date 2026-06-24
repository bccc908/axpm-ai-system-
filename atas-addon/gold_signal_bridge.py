"""
Signal Flag → ATAS bridge

Polls GET /api/gold-signals/atas and prints levels + playbook.
Run on the same PC as ATAS (Windows) or any machine that can reach Signal Flag.

While trading in ATAS, keep this terminal open — new signals show entry/stop/targets
to mark as horizontal lines on your chart.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

SIGNAL_FLAG_URL = os.environ.get(
    "SIGNAL_FLAG_URL", "http://localhost:3000/api/gold-signals/atas"
)
LOCAL_API_KEY = os.environ.get("LOCAL_API_KEY", "")
POLL_SECONDS = int(os.environ.get("GOLD_SIGNAL_POLL_SECONDS", "30"))


def fetch_latest() -> dict | None:
    req = urllib.request.Request(
        SIGNAL_FLAG_URL,
        headers={"Authorization": f"Bearer {LOCAL_API_KEY}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        body = json.loads(res.read().decode("utf-8"))
    alert = body.get("alert")
    return alert if isinstance(alert, dict) else None


def print_levels(alert: dict) -> None:
    bias = alert.get("bias", "?")
    conf = alert.get("confidence", "?")
    print(f"\n=== XAUUSD {str(bias).upper()} {conf}% ===")
    print(alert.get("alert", ""))
    print("\n--- 在 ATAS 画水平线 ---")
    for level in alert.get("levels") or []:
        print(f"  {level.get('label')}: {level.get('price')}")
    stop = alert.get("stop")
    if stop and not any(l.get("kind") == "stop" for l in (alert.get("levels") or [])):
        print(f"  Stop: {stop}")
    for i, tp in enumerate(alert.get("targets") or [], 1):
        print(f"  TP{i}: {tp}")
    print(f"\n失效: {alert.get('invalidation', '')}")
    print("\n--- ATAS 读法 ---")
    print(alert.get("playbook", ""))
    triggers = alert.get("cluster_triggers") or []
    if triggers:
        print("\n--- 触发条件 ---")
        for t in triggers:
            print(f"  • {t}")


def main_loop() -> None:
    if not LOCAL_API_KEY:
        print("Set LOCAL_API_KEY (same as Signal Flag .env.local)")
        return

    last_id: str | None = None
    print(f"ATAS bridge → {SIGNAL_FLAG_URL} every {POLL_SECONDS}s")

    while True:
        try:
            alert = fetch_latest()
            if alert and alert.get("signal_id") != last_id:
                last_id = alert.get("signal_id")
                print_levels(alert)
        except urllib.error.HTTPError as e:
            print(f"HTTP {e.code}: {e.reason}")
        except Exception as e:
            print(f"poll error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main_loop()
