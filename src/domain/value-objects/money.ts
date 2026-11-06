import Decimal from "decimal.js";

/**
 * Money value object (ADR-0003, AGENTS §7).
 * Invariant: amounts are integer minor units held as BigInt.
 * USD 500.00 == 50000n. No float arithmetic ever touches money.
 */
export const SUPPORTED_CURRENCY = "USD" as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCY;

const AMOUNT_TEXT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export class Money {
  readonly minor: bigint;
  readonly currency: SupportedCurrency;

  private constructor(minor: bigint, currency: SupportedCurrency) {
    this.minor = minor;
    this.currency = currency;
  }

  static fromMinor(minor: bigint, currency: string = SUPPORTED_CURRENCY): Money {
    if (currency !== SUPPORTED_CURRENCY) {
      throw new Error(`Unsupported currency: ${currency}. MVP is USD only.`);
    }
    if (minor < 0n) {
      throw new Error("Money amount must not be negative.");
    }
    return new Money(minor, SUPPORTED_CURRENCY);
  }

  /** Convert once at the boundary: decimal string -> minor units. */
  static fromAmountText(amountText: string, currency: string = SUPPORTED_CURRENCY): Money {
    return new Money(toMinorUnits(amountText, currency), SUPPORTED_CURRENCY);
  }

  get isZero(): boolean {
    return this.minor === 0n;
  }

  /** Exact integer-arithmetic formatting, e.g. 50000n -> "500.00". */
  format(): string {
    const major = this.minor / 100n;
    const cents = this.minor % 100n;
    return `${major.toString()}.${cents.toString().padStart(2, "0")}`;
  }
}

/**
 * Decimal-safe conversion: "500.00" -> 50000n.
 * Rejects >2 decimals, negative, empty and non-decimal input.
 */
export function toMinorUnits(amountText: string, currency: string = SUPPORTED_CURRENCY): bigint {
  if (currency !== SUPPORTED_CURRENCY) {
    throw new Error(`Unsupported currency: ${currency}. MVP is USD only.`);
  }
  const trimmed = amountText.trim();
  if (!AMOUNT_TEXT_PATTERN.test(trimmed)) {
    throw new Error(`Invalid amount: ${amountText}. Expected a non-negative decimal with at most 2 decimals.`);
  }
  const minor = new Decimal(trimmed).times(100).toFixed(0);
  return BigInt(minor);
}

export function formatMinor(minor: bigint): string {
  return Money.fromMinor(minor).format();
}
