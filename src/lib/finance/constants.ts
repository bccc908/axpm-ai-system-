export const SUPPORTED_CURRENCIES = ["MYR", "CNY"] as const;
export type FinanceCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: FinanceCurrency = "MYR";

export function isFinanceCurrency(value: string): value is FinanceCurrency {
  return SUPPORTED_CURRENCIES.includes(value as FinanceCurrency);
}
