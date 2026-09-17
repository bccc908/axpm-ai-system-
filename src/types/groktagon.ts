export type GroktagonAgentId = "BRAM" | "HOLT" | "RIGO" | "ILSA" | "KETT" | "TESS";

export type GroktagonAgentStatus = "LIVE" | "IDLE" | "WATCH" | "RISK" | "SCAN";

export type GroktagonLog = {
  id: string;
  agent: GroktagonAgentId;
  kind: "RISK" | "SETTLE" | "FILL" | "SCAN" | "IDLE";
  pnl: number | null;
  text: string;
  at: string;
};

export type GroktagonTicketStatus = "pending" | "approved" | "held";

export type GroktagonTicket = {
  id: string;
  source: "gold" | "btc" | "hl" | "eth";
  symbol: string;
  bias: string;
  confidence: number;
  agent: GroktagonAgentId;
  text: string;
  status: GroktagonTicketStatus;
  created_at: string;
  decided_at: string | null;
  expires_at: string | null;
  entry_low: number | null;
  entry_high: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  block_reason: string | null;
};

export type GroktagonPosition = {
  coin: string;
  side: "long" | "short";
  size: number;
  entry_px: number | null;
  unrealized_pnl: number | null;
};

export type GroktagonWallet = {
  address: string | null;
  source: "hyperliquid" | "mark_path";
  account_value: number | null;
  withdrawable: number | null;
  margin_used: number | null;
  positions: GroktagonPosition[];
};

export type GroktagonAgent = {
  id: GroktagonAgentId;
  role: string;
  status: GroktagonAgentStatus;
  busy: boolean;
  line: string;
};

export type GroktagonQuoteSetup = {
  side: "long" | "short";
  low: number;
  high: number;
  stop: number | null;
  target: number | null;
  when: string;
};

export type GroktagonQuotePlan = {
  coin: "ETH";
  fire: boolean;
  action: "WAIT" | "long" | "short";
  headline: string;
  reason: string;
  mark: number | null;
  bid: number | null;
  ask: number | null;
  spread_bps: number | null;
  bid_usd: number | null;
  ask_usd: number | null;
  best_price: string;
  best_time: string;
  window: "overlap" | "london" | "asia" | "thin";
  window_label: string;
  expires_at: string | null;
  setups: GroktagonQuoteSetup[];
  wait_setup: GroktagonQuoteSetup | null;
  range_low: number | null;
  range_high: number | null;
  bias: string;
  confidence: number | null;
  thesis: string;
};

export type GroktagonState = {
  balance: number;
  pnl: number;
  pnl_note: string;
  subscription: number;
  covered_by_pnl: boolean;
  win_rate: number | null;
  session: string;
  uptime: string;
  process: number;
  books: number;
  position: string;
  equity: number[];
  logs: GroktagonLog[];
  events: Array<{ id: string; title: string; region: string }>;
  quote: { btc: number | null; gold: number | null; eth: number | null; btc_chg: number | null; eth_chg: number | null };
  plan: GroktagonQuotePlan | null;
  bars: Array<{ time: number; open: number; high: number; low: number; close: number }>;
  agents: GroktagonAgent[];
  tickets: GroktagonTicket[];
  book: GroktagonWallet;
  wallet: string | null;
  kett: {
    armed: boolean;
    agent: string | null;
    max_btc: number;
    max_eth: number;
    setup: {
      side: "long" | "short" | null;
      reason: string;
      confidence: number | null;
    };
    eth_setup: {
      side: "long" | "short" | null;
      reason: string;
      confidence: number | null;
    };
    autopilot: {
      enabled: boolean;
      prompt: string;
      last_result: string | null;
      last_run_at: string | null;
      last_fired: boolean;
    };
  };
  as_of: string;
};
