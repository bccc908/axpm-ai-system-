type Field = { x: number; y: number; w: number; h: number };

export type TripComFieldKey = "paymentDate" | "checkIn" | "checkOut" | "subtotal" | "total";

type RowBand = { yMin: number; yMax: number };

function isTextPixel(r: number, g: number, b: number): boolean {
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  return lum < 200 || (lum >= 168 && lum <= 252);
}

function lumAt(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function padField(f: Field, pxX: number, pxY: number): Field {
  return { x: f.x - pxX, y: f.y - pxY, w: f.w + pxX * 2, h: f.h + pxY * 2 };
}

function findHorizontalBorders(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  minX: number,
  maxX: number,
): number[] {
  const borders: number[] = [];
  let inLine = false;
  let lineStart = 0;

  for (let y = 0; y < height; y++) {
    let dark = 0;
    for (let x = minX; x < maxX; x++) {
      if (lumAt(data, width, x, y) < 80) dark++;
    }
    const isLine = dark > (maxX - minX) * 0.55;
    if (isLine && !inLine) {
      inLine = true;
      lineStart = y;
    } else if (!isLine && inLine) {
      inLine = false;
      borders.push(Math.round((lineStart + y - 1) / 2));
    }
  }
  if (inLine) borders.push(Math.round((lineStart + height - 1) / 2));

  const deduped: number[] = [];
  for (const y of borders) {
    if (!deduped.length || y - deduped[deduped.length - 1] > 5) deduped.push(y);
  }
  return deduped;
}

function darkDensityRow(
  data: Uint8ClampedArray,
  width: number,
  y: number,
  minX: number,
  maxX: number,
  lumCutoff = 130,
): number {
  let count = 0;
  for (let x = minX; x < maxX; x++) {
    if (lumAt(data, width, x, y) < lumCutoff) count++;
  }
  return count;
}

function clusterTextRows(
  data: Uint8ClampedArray,
  width: number,
  y1: number,
  y2: number,
  minX: number,
  maxX: number,
  threshold = 18,
  lumCutoff = 130,
): RowBand[] {
  const span = maxX - minX;
  const clusters: RowBand[] = [];
  let cur: RowBand | null = null;

  for (let y = y1; y <= y2; y++) {
    const dark = darkDensityRow(data, width, y, minX, maxX, lumCutoff);
    if (dark >= threshold && dark < span * 0.75) {
      if (!cur) cur = { yMin: y, yMax: y };
      else cur.yMax = y;
    } else if (cur) {
      clusters.push(cur);
      cur = null;
    }
  }
  if (cur) clusters.push(cur);
  return clusters.filter((c) => c.yMax - c.yMin >= 2);
}

function textBoundsInBand(
  data: Uint8ClampedArray,
  width: number,
  y1: number,
  y2: number,
  minX: number,
  maxX: number,
  minCount = 30,
): Field | null {
  let minY = Infinity;
  let maxY = -1;
  let minTextX = Infinity;
  let maxTextX = -1;
  let hits = 0;

  for (let y = y1; y <= y2; y++) {
    for (let x = minX; x < maxX; x++) {
      const i = (y * width + x) * 4;
      if (isTextPixel(data[i], data[i + 1], data[i + 2])) {
        hits++;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minTextX = Math.min(minTextX, x);
        maxTextX = Math.max(maxTextX, x);
      }
    }
  }

  if (hits < minCount || !Number.isFinite(minY)) return null;
  return {
    x: minTextX,
    y: minY,
    w: maxTextX - minTextX + 1,
    h: maxY - minY + 1,
  };
}

function valueField(valueMinX: number, valueMaxX: number, band: RowBand): Field {
  return {
    x: valueMinX,
    y: band.yMin,
    w: valueMaxX - valueMinX,
    h: band.yMax - band.yMin + 1,
  };
}

function amountField(amountMinX: number, valueMaxX: number, band: RowBand): Field {
  return {
    x: amountMinX,
    y: band.yMin,
    w: valueMaxX - amountMinX,
    h: band.yMax - band.yMin + 1,
  };
}

/** Border-anchored fallback for Trip.com receipts when pixel clustering is incomplete. */
function fallbackFromBorders(
  width: number,
  height: number,
  borders: number[],
  valueMinX: number,
  valueMaxX: number,
  amountMinX: number,
): Partial<Record<TripComFieldKey, Field>> {
  const orderHeader = borders.find((y) => y > height * 0.42 && y < height * 0.44) ?? Math.round(height * 0.43);
  const priceHeader = borders.find((y) => y > height * 0.62 && y < height * 0.66) ?? Math.round(height * 0.64);
  const priceMid = borders.find((y) => y > height * 0.72 && y < height * 0.76) ?? Math.round(height * 0.74);
  const priceBottom = borders.filter((y) => y > height * 0.75).at(-1) ?? Math.round(height * 0.79);

  const rowH = Math.max(18, Math.round(height * 0.016));
  const orderStart = orderHeader + Math.round(height * 0.027);

  const fields: Partial<Record<TripComFieldKey, Field>> = {
    paymentDate: {
      x: Math.round(width * 0.15),
      y: Math.round(height * 0.168),
      w: Math.round(width * 0.1),
      h: rowH + 6,
    },
    checkIn: valueField(valueMinX, valueMaxX, {
      yMin: orderHeader + Math.round(height * 0.037),
      yMax: orderHeader + Math.round(height * 0.045),
    }),
    checkOut: valueField(valueMinX, valueMaxX, {
      yMin: orderHeader + Math.round(height * 0.048),
      yMax: orderHeader + Math.round(height * 0.056),
    }),
    subtotal: amountField(amountMinX, valueMaxX, {
      yMin: priceHeader + Math.round((priceMid - priceHeader) * 0.2),
      yMax: priceHeader + Math.round((priceMid - priceHeader) * 0.2) + rowH,
    }),
    total: amountField(amountMinX, valueMaxX, {
      yMin: priceMid + Math.round((priceBottom - priceMid) * 0.25),
      yMax: priceMid + Math.round((priceBottom - priceMid) * 0.25) + rowH + 2,
    }),
  };

  for (const key of Object.keys(fields) as TripComFieldKey[]) {
    fields[key] = padField(fields[key]!, 8, 5);
  }
  return fields;
}

function splitClusterByValleys(
  data: Uint8ClampedArray,
  width: number,
  cluster: RowBand,
  minX: number,
  maxX: number,
): RowBand[] {
  return clusterTextRows(data, width, cluster.yMin, cluster.yMax, minX, maxX, 20, 130);
}

function pickDateBands(
  data: Uint8ClampedArray,
  width: number,
  rows: RowBand[],
  valueMaxX: number,
): { checkIn: RowBand; checkOut: RowBand } | null {
  const usable = rows.filter((r) => r.yMax - r.yMin >= 2 && r.yMax - r.yMin <= 40);
  if (!usable.length) return null;

  const dateMinX = Math.round(valueMaxX * 0.82);

  if (usable.length === 1 && usable[0].yMax - usable[0].yMin > 12) {
    const split = splitClusterByValleys(data, width, usable[0], dateMinX, valueMaxX);
    if (split.length >= 2) {
      return { checkIn: split[1] ?? split[0], checkOut: split[2] ?? { yMin: split[1].yMax + 8, yMax: split[1].yMax + 26 } };
    }
  }

  if (usable.length >= 3) {
    return { checkIn: usable[1], checkOut: usable[2] };
  }
  if (usable.length === 2) {
    const [first, second] = usable;
    if (first.yMax - first.yMin > 14) {
      return { checkIn: second, checkOut: { yMin: second.yMax + 8, yMax: second.yMax + 26 } };
    }
    return { checkIn: first, checkOut: second };
  }

  const only = usable[0];
  return {
    checkIn: { yMin: only.yMin + Math.round((only.yMax - only.yMin) * 0.45), yMax: only.yMax - 2 },
    checkOut: { yMin: only.yMax + 8, yMax: only.yMax + 26 },
  };
}

/** Detect Trip.com receipt value fields from rendered page pixels. */
export function detectTripComFields(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Partial<Record<TripComFieldKey, Field>> | null {
  const valueMinX = Math.round(width * 0.74);
  const valueMaxX = width - 8;
  const amountMinX = Math.round(width * 0.8);
  const leftMinX = Math.round(width * 0.07);
  const leftMaxX = Math.round(width * 0.32);
  const tableMinX = Math.round(width * 0.44);
  const tableMaxX = Math.round(width * 0.92);

  const borders = findHorizontalBorders(data, width, height, tableMinX, tableMaxX);
  if (borders.length < 6) return null;

  const orderHeaderBorder = borders.find((y) => y > height * 0.42 && y < height * 0.44);
  const orderSectionEnd =
    borders.find(
      (y) => orderHeaderBorder != null && y > orderHeaderBorder + 180 && y < height * 0.65,
    ) ?? Math.round(height * 0.62);
  const priceBottomBorder = borders.filter((y) => y > height * 0.75).at(-1);

  if (orderHeaderBorder == null || priceBottomBorder == null) return null;

  const fallback = fallbackFromBorders(width, height, borders, valueMinX, valueMaxX, amountMinX);

  const paymentRaw = textBoundsInBand(
    data,
    width,
    Math.round(height * 0.168),
    Math.round(height * 0.186),
    leftMinX + 138,
    leftMaxX + 80,
    30,
  );

  const orderRows = [
    ...clusterTextRows(
      data,
      width,
      orderHeaderBorder + 20,
      orderSectionEnd - 8,
      Math.round(width * 0.68),
      valueMaxX,
      18,
      130,
    ),
    ...clusterTextRows(
      data,
      width,
      orderHeaderBorder + 60,
      orderSectionEnd - 8,
      Math.round(width * 0.74),
      valueMaxX,
      12,
      155,
    ),
  ].sort((a, b) => a.yMin - b.yMin);
  const dateBands = pickDateBands(data, width, orderRows, valueMaxX);

  const priceHeader = borders.find((y) => y > height * 0.62 && y < height * 0.66) ?? Math.round(height * 0.64);
  const amountRows = clusterTextRows(
    data,
    width,
    priceHeader - 4,
    priceBottomBorder - 2,
    amountMinX,
    valueMaxX,
    15,
    130,
  ).filter((c) => c.yMax - c.yMin >= 4);

  const fields: Partial<Record<TripComFieldKey, Field>> = { ...fallback };

  if (paymentRaw && paymentRaw.w <= 180) {
    fields.paymentDate = padField(paymentRaw, 6, 4);
  }
  if (dateBands) {
    fields.checkIn = padField(valueField(valueMinX, valueMaxX, dateBands.checkIn), 8, 5);
    fields.checkOut = padField(valueField(valueMinX, valueMaxX, dateBands.checkOut), 8, 5);
  }
  if (amountRows.length >= 1) {
    fields.subtotal = padField(amountField(amountMinX, valueMaxX, amountRows[0]), 8, 5);
  }
  if (amountRows.length >= 2) {
    fields.total = padField(amountField(amountMinX, valueMaxX, amountRows.at(-1)!), 8, 5);
  }

  if (!fields.checkIn || !fields.checkOut || !fields.subtotal || !fields.total) return null;
  return fields;
}
