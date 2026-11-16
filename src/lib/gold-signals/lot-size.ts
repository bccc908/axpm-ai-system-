import type { DeskSignal, SignalInstrument } from "@/lib/market-signals/instruments";

/** Standard FX contract: 1.00 lot = 100 oz gold / 5000 oz silver. Not COMEX. */
const OZ_PER_LOT: Partial<Record<SignalInstrument | "xag", number>> = {
  gold: 100,
  xau: 100,
  spread: 100,
  xag: 5000,
};

const CRYPTO_NOTIONAL: Partial<Record<SignalInstrument | "sol" | "xrp", number>> = {
  btc: 12,
  eth: 12,
  hl: 12,
  sol: 8,
  xrp: 8,
};

export type TradeLotHint = {
  wait: boolean;
  lots: number;
  size: number;
  sizeLabel: string;
  notionalUsd: number | null;
  riskUsd: number | null;
  usdPerPoint: number | null;
  contract: string;
  metal: boolean;
};

export type TapeLotVolume = {
  raw: number;
  lots: number | null;
  metal: boolean;
  unit: "gc" | "oz" | "qty";
};

export function isGcVolumeSource(source?: string | null) {
  return Boolean(source && /GC=F|COMEX/i.test(source));
}

export function lotsByStrength(strength: DeskSignal["strength"]): number {
  if (strength === "strong") return 0.05;
  if (strength === "moderate") return 0.02;
  return 0.01;
}

export function formatLots(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0.00";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function suggestTradeLot(
  instrument: SignalInstrument,
  signal: Pick<DeskSignal, "bias" | "strength" | "spot_price" | "entry_zone" | "stop_loss"> | null,
): TradeLotHint {
  const ozPerLot = OZ_PER_LOT[instrument] ?? null;
  const wait = !signal || signal.bias === "wait" || signal.bias === "neutral";
  const entry = signal?.entry_zone
    ? (signal.entry_zone.low + signal.entry_zone.high) / 2
    : (signal?.spot_price ?? null);
  const stop = signal?.stop_loss ?? null;
  const spot = signal?.spot_price ?? entry;

  if (!ozPerLot) {
    const cap = CRYPTO_NOTIONAL[instrument] ?? 8;
    const coins = wait || !spot || spot <= 0 ? 0 : Number((cap / spot).toPrecision(3));
    const id = String(instrument);
    const label =
      id === "btc" || id === "hl" ? "BTC" : id === "eth" ? "ETH" : id === "sol" ? "SOL" : "XRP";
    return {
      wait,
      lots: 0,
      size: coins,
      sizeLabel: label,
      notionalUsd: wait || !spot ? null : coins * spot,
      riskUsd: null,
      usdPerPoint: coins > 0 ? coins : null,
      contract: `perp · max $${cap}`,
      metal: false,
    };
  }

  let lots = wait || !signal ? 0 : lotsByStrength(signal.strength);
  const riskPts = entry != null && stop != null ? Math.abs(entry - stop) : null;
  let riskUsd = lots > 0 && riskPts != null ? lots * ozPerLot * riskPts : null;
  if (riskUsd != null && riskUsd > 10 && riskPts && riskPts > 0) {
    lots = Math.max(0.01, Math.floor(10 / (ozPerLot * riskPts) * 100) / 100);
    riskUsd = lots * ozPerLot * riskPts;
  }

  return {
    wait,
    lots,
    size: lots * ozPerLot,
    sizeLabel: "oz",
    notionalUsd: spot != null && lots > 0 ? lots * ozPerLot * spot : null,
    riskUsd,
    usdPerPoint: lots > 0 ? lots * ozPerLot : null,
    contract: `1.00 = ${ozPerLot} oz`,
    metal: true,
  };
}

export function tapeLotVolume(
  instrument: SignalInstrument,
  bars: Array<{ volume: number }>,
  source?: string | null,
): TapeLotVolume {
  const raw = bars.reduce((sum, bar) => sum + (Number.isFinite(bar.volume) ? bar.volume : 0), 0);
  const ozPerLot = OZ_PER_LOT[instrument];
  if (!ozPerLot) return { raw, lots: null, metal: false, unit: "qty" };
  if (isGcVolumeSource(source)) {
    return { raw, lots: raw, metal: true, unit: "gc" };
  }
  return { raw, lots: raw / ozPerLot, metal: true, unit: "oz" };
}
