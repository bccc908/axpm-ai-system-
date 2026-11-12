/** Every signal engine whose output can reach Telegram. */
export const SIGNAL_ENGINES = ["gold", "btc", "eth", "hl", "xau", "gold-spread"] as const;
export type SignalEngine = (typeof SIGNAL_ENGINES)[number];

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalDecider {
  telegram_user_id: number;
  username: string | null;
  name: string | null;
}

export interface SignalApproval {
  status: ApprovalStatus;
  requested_at: string;
  decided_at: string | null;
  decided_by: ApprovalDecider | null;
  /** Delivery of the approval request to the approver's own chat. Never a client channel. */
  delivery: {
    channel: "telegram";
    message_id: number | null;
    sent_at: string | null;
    error: string | null;
  };
}

/** Optional field carried by every stored signal row. Rows without it were never approved. */
export interface WithApproval {
  approval?: SignalApproval;
}

export function isSignalEngine(v: string): v is SignalEngine {
  return (SIGNAL_ENGINES as readonly string[]).includes(v);
}

export const ENGINE_LABEL: Record<SignalEngine, string> = {
  gold: "Gold XAUUSD",
  btc: "BTC",
  eth: "ETH",
  hl: "Hyperliquid BTC-PERP",
  xau: "XAUUSDT",
  "gold-spread": "Gold spread",
};
