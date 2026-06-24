"""
Signal Flag → MetaTrader 5 (Python)

Requires: pip install MetaTrader5
MT5 terminal must be running and logged in on the same machine.

Modes:
  - print   default: show levels in terminal (like ATAS bridge)
  - lines   not available from Python — use GoldSignalBridge.mq5 EA for chart lines
  - trade   place market order from latest signal (DEMO FIRST)
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None  # type: ignore

SIGNAL_FLAG_URL = os.environ.get(
    "SIGNAL_FLAG_URL", "http://localhost:3000/api/gold-signals/mt5"
)
LOCAL_API_KEY = os.environ.get("LOCAL_API_KEY", "")
POLL_SECONDS = int(os.environ.get("GOLD_SIGNAL_POLL_SECONDS", "30"))
MODE = os.environ.get("MT5_MODE", "print")  # print | trade
MT5_SYMBOL = os.environ.get("MT5_SYMBOL", "XAUUSD")
MT5_LOTS = float(os.environ.get("MT5_LOTS", "0.01"))


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
    print("\n--- MT5 水平线 ---")
    for level in alert.get("levels") or []:
        print(f"  {level.get('label')}: {level.get('price')}")
    print(f"\n失效: {alert.get('invalidation', '')}")
    print(f"建议手数: {alert.get('suggested_lots')} (仅供参考)")


def resolve_symbol(alert: dict) -> str:
    syms = alert.get("mt5_symbols") or []
    if mt5 is None:
        return MT5_SYMBOL
    for s in [MT5_SYMBOL, *syms]:
        if mt5.symbol_info(s) is not None:
            return s
    return MT5_SYMBOL


def place_trade(alert: dict) -> None:
    if mt5 is None:
        print("pip install MetaTrader5")
        return
    if not mt5.initialize():
        print("MT5 initialize failed:", mt5.last_error())
        return

    symbol = resolve_symbol(alert)
    if not mt5.symbol_select(symbol, True):
        print(f"symbol not found: {symbol}")
        mt5.shutdown()
        return

    bias = alert.get("bias")
    if bias not in ("long", "short"):
        print("bias is neutral/wait — no auto trade")
        mt5.shutdown()
        return

    stop = alert.get("stop")
    targets = alert.get("targets") or []
    if stop is None or not targets:
        print("missing stop or targets")
        mt5.shutdown()
        return

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        print("no tick")
        mt5.shutdown()
        return

    order_type = mt5.ORDER_TYPE_BUY if bias == "long" else mt5.ORDER_TYPE_SELL
    price = tick.ask if bias == "long" else tick.bid
    tp = float(targets[0])
    sl = float(stop)
    magic = int(alert.get("magic_number", 20260617))
    comment = str(alert.get("order_comment", "SignalFlag"))[:31]

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": MT5_LOTS,
        "type": order_type,
        "price": price,
        "sl": sl,
        "tp": tp,
        "deviation": 30,
        "magic": magic,
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    result = mt5.order_send(request)
    print("order_send:", result)
    mt5.shutdown()


def main_loop() -> None:
    if not LOCAL_API_KEY:
        print("Set LOCAL_API_KEY (same as Signal Flag .env.local)")
        return

    last_id: str | None = None
    print(f"MT5 bridge → {SIGNAL_FLAG_URL} mode={MODE} every {POLL_SECONDS}s")

    while True:
        try:
            alert = fetch_latest()
            if alert and alert.get("signal_id") != last_id:
                last_id = alert.get("signal_id")
                if MODE == "trade":
                    place_trade(alert)
                else:
                    print_levels(alert)
        except urllib.error.HTTPError as e:
            print(f"HTTP {e.code}: {e.reason}")
        except Exception as e:
            print(f"poll error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main_loop()
