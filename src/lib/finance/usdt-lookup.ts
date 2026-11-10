const TIMEOUT = 10_000;
const USDT_ETH = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDT_BSC = "0x55d398326f99059ff775485246999027b3197955";
const USDT_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export type UsdtTxResult = {
  chain: "eth" | "bsc" | "tron";
  chainLabel: string;
  status: "success" | "pending" | "failed";
  amount: string;
  from: string;
  to: string;
  txHash: string;
  timestamp: string | null;
  explorerUrl: string;
  token: string;
};

export type UsdtBalance = {
  chain: "eth" | "bsc" | "tron";
  chainLabel: string;
  amount: string;
  token: string;
  address: string;
  explorerUrl: string;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function fmt(raw: string | number | bigint, decimals: number): string {
  const n = BigInt(raw);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = n / base;
  const frac = (n % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

function iso(ms: number | string | null | undefined): string | null {
  if (ms == null || ms === "") return null;
  const n = typeof ms === "string" ? Date.parse(ms) || Number(ms) : ms;
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n > 1e12 ? n : n * 1000).toISOString();
}

type ScoutTx = {
  hash?: string;
  status?: string | null;
  timestamp?: string | null;
  from?: { hash?: string };
  to?: { hash?: string };
};
type ScoutTok = {
  items?: Array<{
    from?: { hash?: string };
    to?: { hash?: string };
    total?: { value?: string; decimals?: string };
    token?: { address_hash?: string; address?: string; symbol?: string; decimals?: string };
  }>;
};

async function evmTx(
  chain: "eth" | "bsc",
  hash: string,
): Promise<UsdtTxResult | null> {
  const host = chain === "eth" ? "https://eth.blockscout.com" : "https://bsc.blockscout.com";
  const usdt = chain === "eth" ? USDT_ETH : USDT_BSC;
  const label = chain === "eth" ? "Ethereum (ERC-20)" : "BSC (BEP-20)";
  const explorer = chain === "eth" ? `https://etherscan.io/tx/${hash}` : `https://bscscan.com/tx/${hash}`;
  const tx = await getJson<ScoutTx>(`${host}/api/v2/transactions/${hash}`);
  if (!tx?.hash) return null;
  const toks = await getJson<ScoutTok>(`${host}/api/v2/transactions/${hash}/token-transfers`);
  const hit = toks?.items?.find((i) => {
    const a = (i.token?.address_hash ?? i.token?.address ?? "").toLowerCase();
    return a === usdt || i.token?.symbol?.toUpperCase() === "USDT";
  });
  const status: UsdtTxResult["status"] =
    tx.status === "ok" ? "success" : tx.status === "error" ? "failed" : "pending";
  const decimals = Number(hit?.total?.decimals ?? hit?.token?.decimals ?? (chain === "eth" ? 6 : 18));
  return {
    chain,
    chainLabel: label,
    status,
    amount: hit ? fmt(hit.total?.value ?? "0", decimals) : "0",
    from: (hit?.from?.hash ?? tx.from?.hash ?? "").toLowerCase(),
    to: (hit?.to?.hash ?? tx.to?.hash ?? "").toLowerCase(),
    txHash: hash,
    timestamp: iso(tx.timestamp),
    explorerUrl: explorer,
    token: hit ? "USDT" : "?",
  };
}

type TronScan = {
  hash?: string;
  confirmed?: boolean;
  contractRet?: string;
  timestamp?: number;
  ownerAddress?: string;
  toAddress?: string;
  trc20TransferInfo?: Array<{
    symbol?: string;
    from_address?: string;
    to_address?: string;
    amount_str?: string;
    decimals?: number;
    contract_address?: string;
  }>;
};

async function tronTx(hash: string): Promise<UsdtTxResult | null> {
  const json =
    (await getJson<TronScan>(
      `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(hash)}`,
    )) ??
    (await getJson<TronScan>(
      `https://apilist.tronscan.org/api/transaction-info?hash=${encodeURIComponent(hash)}`,
    ));
  if (!json?.hash && !json?.trc20TransferInfo?.length) {
    const grid = await getJson<{ data?: Array<{ txID?: string }> }>(
      `https://api.trongrid.io/v1/transactions/${encodeURIComponent(hash)}`,
    );
    if (!grid?.data?.[0]?.txID) return null;
  }
  const usdt = json?.trc20TransferInfo?.find(
    (t) => t.symbol?.toUpperCase() === "USDT" || t.contract_address === USDT_TRON,
  );
  const ok = json?.contractRet === "SUCCESS" || json?.confirmed;
  const status: UsdtTxResult["status"] = json?.confirmed
    ? ok
      ? "success"
      : "failed"
    : json?.contractRet
      ? json.contractRet === "SUCCESS"
        ? "success"
        : "failed"
      : "pending";
  return {
    chain: "tron",
    chainLabel: "TRON (TRC-20)",
    status,
    amount: usdt ? fmt(usdt.amount_str ?? "0", usdt.decimals ?? 6) : "0",
    from: usdt?.from_address ?? json?.ownerAddress ?? "",
    to: usdt?.to_address ?? json?.toAddress ?? "",
    txHash: json?.hash ?? hash,
    timestamp: iso(json?.timestamp),
    explorerUrl: `https://tronscan.org/#/transaction/${hash}`,
    token: usdt ? "USDT" : "?",
  };
}

function pickTrc20Amount(trc20: unknown, contract: string): string | null {
  if (!Array.isArray(trc20)) return null;
  for (const row of trc20) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, string>;
    const raw = rec[contract];
    if (raw != null) return String(raw);
  }
  return null;
}

function tronAddressParam(address: string): string | null {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt(0);
  for (const c of address) {
    const i = alphabet.indexOf(c);
    if (i < 0) return null;
    n = n * BigInt(58) + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let pad = 0;
  for (const c of address) {
    if (c === "1") pad += 1;
    else break;
  }
  hex = `${"00".repeat(pad)}${hex}`;
  if (hex.length < 50) hex = hex.padStart(50, "0");
  const body = hex.slice(0, hex.length - 8);
  if (!body.toLowerCase().startsWith("41") || body.length !== 42) return null;
  return body.slice(2).padStart(64, "0");
}

async function tronUsdtRaw(address: string): Promise<string | null> {
  const parameter = tronAddressParam(address);
  if (parameter) {
    const call = await getJson<{ constant_result?: string[] }>(
      "https://api.trongrid.io/wallet/triggerconstantcontract",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_address: address,
          contract_address: USDT_TRON,
          function_selector: "balanceOf(address)",
          parameter,
          visible: true,
        }),
      },
    );
    const hex = call?.constant_result?.[0];
    if (hex) return BigInt(`0x${hex}`).toString();
  }
  const grid = await getJson<{ data?: Array<{ trc20?: unknown }> }>(
    `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`,
  );
  return pickTrc20Amount(grid?.data?.[0]?.trc20, USDT_TRON);
}

async function tronBalance(address: string): Promise<UsdtBalance> {
  const raw = await tronUsdtRaw(address);
  return {
    chain: "tron",
    chainLabel: "TRON (TRC-20)",
    amount: fmt(raw ?? "0", 6),
    token: "USDT",
    address,
    explorerUrl: `https://tronscan.org/#/address/${address}`,
  };
}

async function evmBalance(chain: "eth" | "bsc", address: string): Promise<UsdtBalance> {
  const host = chain === "eth" ? "https://eth.blockscout.com" : "https://bsc.blockscout.com";
  const usdt = chain === "eth" ? USDT_ETH : USDT_BSC;
  const label = chain === "eth" ? "Ethereum (ERC-20)" : "BSC (BEP-20)";
  const explorer =
    chain === "eth" ? `https://etherscan.io/address/${address}` : `https://bscscan.com/address/${address}`;
  const json = await getJson<
    Array<{
      token?: { address_hash?: string; address?: string; symbol?: string; decimals?: string };
      value?: string;
    }>
  >(`${host}/api/v2/addresses/${address}/token-balances`);
  const hit = json?.find((i) => {
    const a = (i.token?.address_hash ?? i.token?.address ?? "").toLowerCase();
    return a === usdt || i.token?.symbol?.toUpperCase() === "USDT";
  });
  const decimals = Number(hit?.token?.decimals ?? (chain === "eth" ? 6 : 18));
  return {
    chain,
    chainLabel: label,
    amount: hit ? fmt(hit.value ?? "0", Number.isFinite(decimals) ? decimals : 6) : "0",
    token: "USDT",
    address,
    explorerUrl: explorer,
  };
}

async function tronAddress(address: string): Promise<UsdtTxResult[]> {
  const params = new URLSearchParams({
    limit: "20",
    contract_address: USDT_TRON,
    only_confirmed: "true",
  });
  const json = await getJson<{
    data?: Array<{
      transaction_id?: string;
      from?: string;
      to?: string;
      value?: string;
      block_timestamp?: number;
      token_info?: { symbol?: string; decimals?: number };
    }>;
  }>(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?${params}`);
  return (json?.data ?? [])
    .filter((row) => (row.token_info?.symbol ?? "USDT").toUpperCase() === "USDT")
    .map((row) => ({
      chain: "tron" as const,
      chainLabel: "TRON (TRC-20)",
      status: "success" as const,
      amount: fmt(row.value ?? "0", row.token_info?.decimals ?? 6),
      from: row.from ?? "",
      to: row.to ?? "",
      txHash: row.transaction_id ?? "",
      timestamp: iso(row.block_timestamp),
      explorerUrl: `https://tronscan.org/#/transaction/${row.transaction_id ?? ""}`,
      token: "USDT",
    }))
    .filter((row) => row.txHash);
}

async function evmAddress(chain: "eth" | "bsc", address: string): Promise<UsdtTxResult[]> {
  const host = chain === "eth" ? "https://eth.blockscout.com" : "https://bsc.blockscout.com";
  const usdt = chain === "eth" ? USDT_ETH : USDT_BSC;
  const label = chain === "eth" ? "Ethereum (ERC-20)" : "BSC (BEP-20)";
  const json = await getJson<ScoutTok>(
    `${host}/api/v2/addresses/${address}/token-transfers?type=ERC-20`,
  );
  return (json?.items ?? [])
    .filter((i) => {
      const a = (i.token?.address_hash ?? i.token?.address ?? "").toLowerCase();
      return a === usdt || i.token?.symbol?.toUpperCase() === "USDT";
    })
    .slice(0, 20)
    .map((i) => {
      const decimals = Number(i.total?.decimals ?? i.token?.decimals ?? (chain === "eth" ? 6 : 18));
      const from = (i.from?.hash ?? "").toLowerCase();
      const to = (i.to?.hash ?? "").toLowerCase();
      return {
        chain,
        chainLabel: label,
        status: "success" as const,
        amount: fmt(i.total?.value ?? "0", Number.isFinite(decimals) ? decimals : 6),
        from,
        to,
        txHash: "",
        timestamp: null,
        explorerUrl:
          chain === "eth" ? `https://etherscan.io/address/${address}` : `https://bscscan.com/address/${address}`,
        token: "USDT",
      };
    });
}

export async function lookupUsdtTx(raw: string): Promise<UsdtTxResult | null> {
  const hash = raw.trim().replace(/\s+/g, "");
  if (/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    const [eth, bsc] = await Promise.all([evmTx("eth", hash), evmTx("bsc", hash)]);
    return eth?.token === "USDT" ? eth : bsc?.token === "USDT" ? bsc : eth ?? bsc;
  }
  if (/^[a-fA-F0-9]{64}$/.test(hash)) {
    const tron = await tronTx(hash);
    if (tron) return tron;
    const prefixed = `0x${hash}`;
    const [eth, bsc] = await Promise.all([evmTx("eth", prefixed), evmTx("bsc", prefixed)]);
    return eth ?? bsc;
  }
  return null;
}

export type UsdtLookupKind = "tx" | "address";

export async function lookupUsdtQuery(raw: string): Promise<{
  kind: UsdtLookupKind;
  result: UsdtTxResult | null;
  transfers: UsdtTxResult[];
  balances: UsdtBalance[];
}> {
  const q = raw.trim().replace(/\s+/g, "");
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(q)) {
    const [transfers, balance] = await Promise.all([tronAddress(q), tronBalance(q)]);
    return { kind: "address", result: transfers[0] ?? null, transfers, balances: [balance] };
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
    const [eth, bsc, ethBal, bscBal] = await Promise.all([
      evmAddress("eth", q),
      evmAddress("bsc", q),
      evmBalance("eth", q),
      evmBalance("bsc", q),
    ]);
    const transfers = [...eth, ...bsc].slice(0, 30);
    const balances = [ethBal, bscBal];
    return { kind: "address", result: transfers[0] ?? null, transfers, balances };
  }
  const result = await lookupUsdtTx(q);
  return { kind: "tx", result, transfers: result ? [result] : [], balances: [] };
}
