import * as XLSX from "xlsx";

export type ParsedExcelSheet = {
  name: string;
  headers: string[];
  rows: Record<string, string | number | null>[];
  rowCount: number;
};

export type ParsedExcelWorkbook = {
  fileName: string;
  sheets: ParsedExcelSheet[];
  sheetNames: string[];
};

function cellValue(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text || null;
}

function sheetToTable(sheet: XLSX.WorkSheet, name: string, maxRows = 5000): ParsedExcelSheet {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  if (matrix.length === 0) {
    return { name, headers: [], rows: [], rowCount: 0 };
  }

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((cell, i) => {
    const label = cellValue(cell);
    return label ? String(label) : `列${i + 1}`;
  });

  const rows: Record<string, string | number | null>[] = [];
  for (const row of matrix.slice(1, maxRows + 1)) {
    if (!row?.some((cell) => cellValue(cell) != null)) continue;
    const record: Record<string, string | number | null> = {};
    headers.forEach((header, i) => {
      record[header] = cellValue(row[i]);
    });
    rows.push(record);
  }

  return {
    name,
    headers,
    rows,
    rowCount: Math.max(0, matrix.length - 1),
  };
}

export function parseExcelBuffer(
  buffer: Buffer,
  fileName: string,
  maxRows = 5000,
): ParsedExcelWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets = workbook.SheetNames.map((name) =>
    sheetToTable(workbook.Sheets[name], name, maxRows),
  );

  return {
    fileName,
    sheetNames: workbook.SheetNames,
    sheets,
  };
}

export function excelSheetsToText(workbook: ParsedExcelWorkbook): string {
  const parts: string[] = [`# ${workbook.fileName}`];
  for (const sheet of workbook.sheets) {
    parts.push(`\n## ${sheet.name} (${sheet.rowCount} rows)`);
    if (!sheet.headers.length) continue;
    parts.push(sheet.headers.join("\t"));
    for (const row of sheet.rows.slice(0, 200)) {
      parts.push(sheet.headers.map((h) => String(row[h] ?? "")).join("\t"));
    }
    if (sheet.rowCount > 200) {
      parts.push(`… ${sheet.rowCount - 200} more rows`);
    }
  }
  return parts.join("\n");
}
