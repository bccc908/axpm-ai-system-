import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { roleCanAccessModule } from "@/lib/auth/permissions";
import { hlInfo } from "@/lib/hyperliquid/client";
import { fetchHlTape, formatTapeNotes, type HlTapeCoin } from "@/lib/hyperliquid/tape";
import { fetchHlBook } from "@/lib/hyperliquid/book";
import { fetchMetalLiquidity, type MetalLiqCoin } from "@/lib/gold-signals/metal-liquidity";

export const dynamic = "force-dynamic";

function parseMetal(value: string | null): MetalLiqCoin | null {
  const coin = value?.trim().toUpperCase();
  if (coin === "XAU" || coin === "GOLD" || coin === "XAUUSD" || coin === "XAUUSDT") return "XAU";
  if (coin === "XAG" || coin === "SILVER" || coin === "XAGUSD" || coin === "XAGUSDT") return "XAG";
  return null;
}

function parseHlCoin(value: string | null): HlTapeCoin {
  const coin = value?.trim().toUpperCase();
  if (coin === "ETH" || coin === "SOL" || coin === "XRP" || coin === "BTC") return coin;
  return "BTC";
}

type L2Level = { px?: string; sz?: string };
type L2Book = { levels?: [L2Level[], L2Level[]] };

function toLevels(rows: L2Level[]) {
  const out: Array<{ px: number; sz: number; usd: number }> = [];
  for (const lvl of rows) {
    const px = Number(lvl.px);
    const sz = Number(lvl.sz);
    if (!Number.isFinite(px) || !Number.isFinite(sz) || px <= 0 || sz <= 0) continue;
    out.push({ px, sz, usd: px * sz });
  }
  return out;
}

/** Live book.ts only returns the top of book. The ladder needs the level arrays. */
async function fetchHlLevels(coin: HlTapeCoin) {
  try {
    const raw = await hlInfo<L2Book>({ type: "l2Book", coin });
    const bids = toLevels(raw.levels?.[0] ?? []);
    const asks = toLevels(raw.levels?.[1] ?? []);
    if (!bids.length || !asks.length) return null;
    return { bids, asks };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const ctx = await getServerSession();
  if (!ctx) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!roleCanAccessModule(ctx.user.role, "market")) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("coin");
  try {
    const fast = url.searchParams.get("fast") === "1";
    const metal = parseMetal(raw);
    if (metal) {
      const pack = await fetchMetalLiquidity(metal, { fast });
      if (!pack?.tape && !pack?.book) {
        return NextResponse.json(
          { coin: metal, book: null, tape: null, levels: { bids: [], asks: [] }, prints: [], error: "tape unavailable" },
          { status: 200 },
        );
      }
      return NextResponse.json({
        coin: metal,
        book: pack.book,
        tape: pack.tape,
        levels: pack.levels,
        prints: pack.prints ?? [],
        updated_at: pack.tape?.as_of ?? new Date().toISOString(),
      });
    }

    const coin = parseHlCoin(raw);
    const quoteCoin = coin === "BTC" || coin === "ETH" ? coin : null;
    const [book, levels] = await Promise.all([
      quoteCoin ? fetchHlBook(quoteCoin) : Promise.resolve(null),
      fetchHlLevels(coin),
    ]);
    if (fast) {
      return NextResponse.json({
        coin,
        book: book ? { ...book, venue: `Hyperliquid ${coin}` } : null,
        tape: null,
        levels: levels ?? { bids: [], asks: [] },
        updated_at: book?.as_of ?? new Date().toISOString(),
      });
    }
    const tape = await fetchHlTape(coin, book);
    if (!tape) {
      return NextResponse.json({ error: "tape unavailable" }, { status: 502 });
    }
    return NextResponse.json({
      coin,
      book: book ? { ...book, venue: `Hyperliquid ${coin}` } : null,
      tape,
      notes: formatTapeNotes(tape),
      levels: levels ?? { bids: [], asks: [] },
      updated_at: tape.as_of,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "liquidity fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
