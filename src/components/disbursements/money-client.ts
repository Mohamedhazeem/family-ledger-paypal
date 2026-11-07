/**
 * Client-side money helpers (Slice 2.6). Integer/string math only —
 * never float arithmetic (AGENTS §7). Mirrors the domain rule
 * `/^\d+(?:\.\d{1,2})?$/` for decimal text.
 */
export const DECIMAL_TEXT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/** Decimal text ("500.00") → integer minor units (50000), or null. */
export function decimalToMinor(text: string): number | null {
  const match = text.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = (match[2] ?? "").padEnd(2, "0");
  return Number(match[1]) * 100 + Number(cents);
}

/** Integer minor units (50000) → decimal text ("500.00"). */
export function minorToDecimal(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export function isValidDecimalText(text: string): boolean {
  return DECIMAL_TEXT_PATTERN.test(text.trim());
}
