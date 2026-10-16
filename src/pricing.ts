/**
 * Pricing primitives.
 *
 * Clean-room reconstruction from static evidence only.
 *
 * SOURCE ARTIFACT
 *   index-BvjQI7i8.js  (sha256 2e3bf0bc172644d7…), offsets ~686355–687100 —
 *   the quote editor's normalization and totals functions, plus the material
 *   row field-edit handler.
 *
 * EVIDENCE TAG: SEEN. Every function below transcribes a literal expression
 * from the artifact. Where the original has a quirk, the quirk is preserved
 * deliberately and called out — these are reproduced behaviours, not bugs to
 * be fixed.
 *
 * NOT IMPLEMENTED (no local evidence):
 *   - deposit amount computation from `deposit_percentage`
 *   - payment_type domain beyond the one observed literal `"deposit"`
 *   - any balance, tax-rate override, discount, or rounding-policy rule
 */

/* -------------------------------------------------------------------------- */
/* Numeric coercion                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The coercion template observed throughout the bundle:
 *
 *     typeof x === "string" ? parseFloat(x) || 0 : x || 0
 *
 * Quirk preserved: the non-string branch returns `x` *raw*. A truthy
 * non-numeric non-string (e.g. `true`, `{}`) passes through unconverted. The
 * original does the same, and downstream sums absorb it inconsistently.
 */
export function toNumber(value: unknown): number {
  if (typeof value === "string") {
    return parseFloat(value) || 0;
  }
  return (value || 0) as number;
}

/**
 * Two-decimal rounding exactly as observed: `Math.round(x * 100) / 100`.
 *
 * This is round-half-toward-positive-infinity (`Math.round`), NOT banker's
 * rounding and NOT `toFixed`. It is preserved because the difference is
 * observable at exact .005 boundaries, especially for negatives.
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Materials                                                                   */
/* -------------------------------------------------------------------------- */

/** One materials row. Fields are unknown-typed: the original is untyped here. */
export interface MaterialRow {
  item?: string;
  quantity?: unknown;
  unitPrice?: unknown;
  totalPrice?: unknown;
  [key: string]: unknown;
}

/** The row literal the original uses when a new material is added. */
export function newMaterialRow(): MaterialRow {
  return { item: "", quantity: "1", unitPrice: 0, totalPrice: 0 };
}

/**
 * Materials-row total recomputation, from the field-edit handler:
 *
 *     const P = N === "quantity" ? parseFloat(S) || 0 : parseFloat(row.quantity) || 0;
 *     const k = N === "unitPrice" ? S : row.unitPrice;
 *     row.totalPrice = P * k;
 *
 * The partner operand is used **raw** — the original does not coerce it. A
 * non-numeric partner therefore yields `NaN`. That `NaN` is absorbed later by
 * {@link sumMaterialTotalPrices}, which coerces via `x || 0`.
 */
export function materialRowTotalPrice(quantityRaw: unknown, unitPriceRaw: unknown): number {
  const quantity = parseFloat(quantityRaw as string) || 0;
  return quantity * (unitPriceRaw as number);
}

/**
 * Materials total, transcribed verbatim from the reduce in the totals function:
 *
 *     const N = (materials?.reduce((T, M) => {
 *       const $ = typeof M.totalPrice === "string" ? parseFloat(M.totalPrice) || 0 : M.totalPrice || 0;
 *       return T + $;
 *     }, 0)) || 0;
 *
 * Quirk preserved: `NaN` and empty arrays both collapse to `0` via the
 * trailing `|| 0`.
 */
export function sumMaterialTotalPrices(
  materials: readonly MaterialRow[] | null | undefined,
): number {
  const sum = materials?.reduce<number>((total, row) => {
    const amount =
      typeof row.totalPrice === "string" ? parseFloat(row.totalPrice) || 0 : row.totalPrice || 0;
    return total + (amount as number);
  }, 0);

  return (sum || 0) as number;
}

/* -------------------------------------------------------------------------- */
/* Labor                                                                       */
/* -------------------------------------------------------------------------- */

export interface LaborInput {
  totalCost?: unknown;
  [key: string]: unknown;
}

/**
 * Labor cost, transcribed verbatim:
 *
 *     const S = (k = quote.labor) != null && k.totalCost
 *       ? (typeof k.totalCost === "string" ? parseFloat(k.totalCost) || 0 : k.totalCost)
 *       : 0;
 *
 * Two quirks preserved deliberately:
 *
 *   1. The guard is **truthiness of `totalCost`**, not a null check. A labor
 *      object present with `totalCost: 0` yields `0` — correct — but so does
 *      `totalCost: ""` or `totalCost: null`, which silently produce no labor
 *      cost even though the object exists.
 *   2. The non-string branch has **no `|| 0`**, unlike the general coercion
 *      template. A truthy non-numeric `totalCost` therefore leaks into the sum.
 */
export function laborCost(labor: LaborInput | null | undefined): number {
  if (labor == null || !labor.totalCost) return 0;
  if (typeof labor.totalCost === "string") return parseFloat(labor.totalCost) || 0;
  return labor.totalCost as number;
}

/* -------------------------------------------------------------------------- */
/* Totals                                                                      */
/* -------------------------------------------------------------------------- */

/** Observed tax rate. Literal `.08` in the source; not configurable. */
export const TAX_RATE = 0.08;

export interface QuoteTotalsInput {
  materials?: readonly MaterialRow[] | null;
  labor?: LaborInput | null;
}

export interface QuoteTotals {
  /** `Math.round((materials + labor) * 100) / 100` */
  subtotal: number;
  /** `Math.round(((materials + labor) * .08) * 100) / 100` */
  tax: number;
  /** `Math.round(((materials + labor) + tax) * 100) / 100` */
  totalCost: number;
}

/**
 * Quote totals, transcribed verbatim:
 *
 *     const _ = N + S;
 *     const C = Math.round(_ * .08 * 100) / 100;
 *     const E = Math.round((_ + C) * 100) / 100;
 *     return { ...quote, subtotal: Math.round(_ * 100) / 100, tax: C, totalCost: E };
 *
 * Quirks preserved:
 *
 *   - Tax is computed as `(_ * .08) * 100` — left-to-right, **not** `(_ * 8)`.
 *     These differ in floating point and the order is kept.
 *   - `totalCost` is derived from the **unrounded** `_`, not from the rounded
 *     `subtotal`. So `subtotal + tax !== totalCost` is possible and expected.
 */
export function computeQuoteTotals(quote: QuoteTotalsInput): QuoteTotals {
  const materialsTotal = sumMaterialTotalPrices(quote.materials);
  const laborTotal = laborCost(quote.labor);

  const rawSubtotal = materialsTotal + laborTotal;
  const tax = Math.round(rawSubtotal * 0.08 * 100) / 100;
  const totalCost = Math.round((rawSubtotal + tax) * 100) / 100;

  return {
    subtotal: Math.round(rawSubtotal * 100) / 100,
    tax,
    totalCost,
  };
}

/* -------------------------------------------------------------------------- */
/* Payment                                                                     */
/* -------------------------------------------------------------------------- */

export interface BalanceRow {
  amount_due?: unknown;
  total_cost?: unknown;
}

/**
 * Balance due, transcribed from the customer-row mapping:
 *
 *     amount_due: row.amount_due || row.total_cost || 0
 *
 * Quirk preserved: any falsy `amount_due` — including a legitimate `0` and
 * including `NaN` — falls through to `total_cost`.
 */
export function balanceDue(row: BalanceRow): number {
  return (row.amount_due || row.total_cost || 0) as number;
}

/**
 * Deposit percentage, transcribed from the payment-link payload:
 *
 *     deposit_percentage: paymentType === "deposit" ? depositPercentage : undefined
 *
 * Only the literal `"deposit"` triggers it. The complete `payment_type` domain
 * is UNKNOWN — a broadened static sweep found no other values, which is not
 * proof that none exist.
 */
export function depositPercentage(
  paymentType: unknown,
  depositPercentageRaw: number | undefined,
): number | undefined {
  return paymentType === "deposit" ? depositPercentageRaw : undefined;
}