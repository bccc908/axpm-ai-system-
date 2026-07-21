/** Quick CLI check: node scripts/test-gold-chart.mjs */
async function fetchSpotFallbackBars(count = 120) {
  const res = await fetch("https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("goldprice failed " + res.status);
  const data = await res.json();
  const spot = Number(data.symbols?.[0]?.price);
  if (!Number.isFinite(spot)) throw new Error("no spot");

  const now = Math.floor(Date.now() / 1000);
  const bars = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * 60;
    const wobble = Math.sin(i / 5) * 0.45 + Math.cos(i / 8) * 0.35;
    const open =
      i === count - 1 ? Math.round((spot - wobble) * 100) / 100 : bars[bars.length - 1].close;
    const close = Math.round((spot + wobble) * 100) / 100;
    bars.push({
      time: t - (t % 60),
      open,
      high: Math.round((Math.max(open, close) + 0.25) * 100) / 100,
      low: Math.round((Math.min(open, close) - 0.25) * 100) / 100,
      close,
      volume: 100 + ((i * 17) % 90),
    });
  }
  return bars;
}

const bars = await fetchSpotFallbackBars();
console.log(
  JSON.stringify(
    { bars: bars.length, enoughForOrderFlow: bars.length >= 4, last: bars.at(-1) },
    null,
    2,
  ),
);
