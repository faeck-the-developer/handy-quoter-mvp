import test from "node:test";
import assert from "node:assert/strict";

import {
  TAX_RATE,
  balanceDue,
  computeQuoteTotals,
  depositPercentage,
  laborCost,
  materialRowTotalPrice,
  newMaterialRow,
  round2,
  sumMaterialTotalPrices,
  toNumber,
} from "../src/pricing.ts";

/* -------------------------------------------------------------------------- */
/* toNumber — typeof x === "string" ? parseFloat(x) || 0 : x || 0               */
/* -------------------------------------------------------------------------- */

test("toNumber: ordinary numeric inputs pass through", () => {
  assert.equal(toNumber(5), 5);
  assert.equal(toNumber(12.5), 12.5);
  assert.equal(toNumber(-3), -3);
  assert.equal(toNumber(0), 0);
});

test("toNumber: numeric strings are parsed", () => {
  assert.equal(toNumber("5"), 5);
  assert.equal(toNumber("5.50"), 5.5);
  assert.equal(toNumber("-7.25"), -7.25);
  assert.equal(toNumber(".5"), 0.5);
  assert.equal(toNumber("1e3"), 1000);
  assert.equal(toNumber("  7  "), 7);
});

test("toNumber: unparseable strings collapse to 0 via NaN || 0", () => {
  assert.equal(toNumber(""), 0);
  assert.equal(toNumber("abc"), 0);
  assert.equal(toNumber("  "), 0);
  assert.equal(toNumber("-"), 0);
});

test("toNumber: parseFloat is partial, so trailing junk is dropped", () => {
  // Quirk of the observed expression: parseFloat("12abc") === 12.
  assert.equal(toNumber("12abc"), 12);
  assert.equal(toNumber("3.5kg"), 3.5);
  assert.equal(toNumber("50%"), 50);
});

test("toNumber: missing and falsy inputs become 0", () => {
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber(false), 0);
  assert.equal(toNumber(NaN), 0);
  assert.equal(toNumber(""), 0);
});

test("toNumber: the string \"-0\" yields +0 because -0 is falsy", () => {
  // parseFloat("-0") is -0, and `-0 || 0` takes the right branch.
  const result = toNumber("-0");
  assert.equal(result, 0);
  assert.ok(!Object.is(result, -0), "expected +0, not negative zero");
});

test("toNumber: truthy non-string values are returned RAW (observed quirk)", () => {
  // The non-string branch is a bare `x || 0` with no conversion, so a truthy
  // non-string is returned unconverted. Reproduced deliberately.
  assert.strictEqual(toNumber(true), true as unknown as number);

  const obj = { a: 1 };
  assert.strictEqual(toNumber(obj) as unknown, obj); // identity, not deep equality

  const arr: unknown[] = [];
  assert.strictEqual(toNumber(arr) as unknown, arr);

  assert.equal(toNumber("Infinity"), Infinity);
});

/* -------------------------------------------------------------------------- */
/* round2 — Math.round(x * 100) / 100                                          */
/* -------------------------------------------------------------------------- */

test("round2: ordinary values round to two decimals", () => {
  assert.equal(round2(1.234), 1.23);
  assert.equal(round2(1.236), 1.24);
  assert.equal(round2(10), 10);
  assert.equal(round2(0), 0);
});

test("round2: uses Math.round (half toward +Infinity), not banker's rounding", () => {
  // Math.round(0.5) === 1 whereas a banker's rounding would give 0.
  assert.equal(round2(0.005), 0.01);
  assert.equal(round2(0.015), 0.02);
  assert.equal(round2(0.025), 0.03);
  assert.ok(Object.is(round2(-0.005), -0)); // Math.round(-0.5) === -0
});

test("round2: reproduces floating-point artefacts rather than hiding them", () => {
  // These are the values a naive `toFixed(2)` implementation would get
  // "right" and this one deliberately does not.
  assert.equal(round2(1.005), 1); // 1.005 * 100 === 100.49999999999999
  assert.equal(round2(1.015), 1.01);
  assert.equal(round2(10.005), 10.01); // same magnitude issue, different outcome
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test("round2: positive and negative values round asymmetrically at .xx5", () => {
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(-2.675), -2.67);
});

test("round2: negative zero is produced and preserved", () => {
  const result = round2(-0.005);
  assert.ok(Object.is(result, -0), "expected negative zero");
  // Note: `assert.strictEqual(-0, 0)` FAILS under strict comparison, which is
  // itself evidence that the sign survived.
  assert.notStrictEqual(result, 0);
  assert.ok(Math.abs(result) === 0);
});

/* -------------------------------------------------------------------------- */
/* Materials                                                                   */
/* -------------------------------------------------------------------------- */

test("newMaterialRow: matches the observed default row literal", () => {
  assert.deepEqual(newMaterialRow(), {
    item: "",
    quantity: "1", // string "1", not the number 1
    unitPrice: 0,
    totalPrice: 0,
  });
});

test("materialRowTotalPrice: quantity is coerced, partner is raw", () => {
  assert.equal(materialRowTotalPrice("3", 10), 30);
  assert.equal(materialRowTotalPrice(3, 10), 30);
  assert.equal(materialRowTotalPrice("2", "4.5"), 9); // JS coerces the string partner
  assert.equal(materialRowTotalPrice("abc", 10), 0); // parseFloat NaN || 0
  assert.equal(materialRowTotalPrice(2, ""), 0);
});

test("materialRowTotalPrice: a non-numeric partner yields NaN", () => {
  // Observed: the partner operand is used without coercion.
  assert.ok(Number.isNaN(materialRowTotalPrice(2, "abc")));
});

test("sumMaterialTotalPrices: sums coerced totalPrice values", () => {
  assert.equal(sumMaterialTotalPrices([{ totalPrice: 100 }, { totalPrice: 25.5 }]), 125.5);
  assert.equal(sumMaterialTotalPrices([{ totalPrice: "10" }, { totalPrice: "5.5" }]), 15.5);
});

test("sumMaterialTotalPrices: NaN and empty collapse to 0", () => {
  assert.equal(sumMaterialTotalPrices([{ totalPrice: NaN }, { totalPrice: 50 }]), 50);
  assert.equal(sumMaterialTotalPrices([]), 0);
  assert.equal(sumMaterialTotalPrices(null), 0);
  assert.equal(sumMaterialTotalPrices(undefined), 0);
});

test("sumMaterialTotalPrices: string totalPrice is parsed, junk dropped", () => {
  assert.equal(sumMaterialTotalPrices([{ totalPrice: "25.50" }]), 25.5);
  assert.equal(sumMaterialTotalPrices([{ totalPrice: "" }]), 0);
  assert.equal(sumMaterialTotalPrices([{ totalPrice: "7abc" }]), 7);
});

/* -------------------------------------------------------------------------- */
/* Labor                                                                       */
/* -------------------------------------------------------------------------- */

test("laborCost: numeric and string values", () => {
  assert.equal(laborCost({ totalCost: 200 }), 200);
  assert.equal(laborCost({ totalCost: "150.5" }), 150.5);
});

test("laborCost: missing labor yields 0", () => {
  assert.equal(laborCost(null), 0);
  assert.equal(laborCost(undefined), 0);
});

test("laborCost: guard is TRUTHINESS of totalCost, not a null check", () => {
  // An existing labor object with a falsy totalCost contributes nothing.
  assert.equal(laborCost({ totalCost: 0 }), 0);
  assert.equal(laborCost({ totalCost: "" }), 0);
  assert.equal(laborCost({ totalCost: null }), 0);
  assert.equal(laborCost({ totalCost: NaN }), 0);
  assert.equal(laborCost({}), 0);
});

test("laborCost: truthy non-string totalCost is returned RAW (observed quirk)", () => {
  // Unlike toNumber, this branch has no `|| 0` fallback.
  assert.equal(laborCost({ totalCost: true }) as unknown, true);
});

test("laborCost: unparseable string totalCost becomes 0", () => {
  assert.equal(laborCost({ totalCost: "abc" }), 0);
});

/* -------------------------------------------------------------------------- */
/* Totals                                                                      */
/* -------------------------------------------------------------------------- */

test("TAX_RATE: the observed literal", () => {
  assert.equal(TAX_RATE, 0.08);
});

test("computeQuoteTotals: ordinary quote", () => {
  assert.deepEqual(
    computeQuoteTotals({ materials: [{ totalPrice: 100 }], labor: { totalCost: 200 } }),
    { subtotal: 300, tax: 24, totalCost: 324 },
  );
});

test("computeQuoteTotals: empty and missing inputs all yield zero", () => {
  const zero = { subtotal: 0, tax: 0, totalCost: 0 };
  assert.deepEqual(computeQuoteTotals({ materials: null, labor: null }), zero);
  assert.deepEqual(computeQuoteTotals({ materials: [], labor: null }), zero);
  assert.deepEqual(computeQuoteTotals({}), zero);
});

test("computeQuoteTotals: 8% tax, two-decimal rounding", () => {
  const t = computeQuoteTotals({ materials: [{ totalPrice: "25.50" }], labor: null });
  assert.deepEqual(t, { subtotal: 25.5, tax: 2.04, totalCost: 27.54 });
});

test("computeQuoteTotals: NaN material totalPrice is absorbed as 0", () => {
  assert.deepEqual(
    computeQuoteTotals({ materials: [{ totalPrice: NaN }], labor: { totalCost: 200 } }),
    { subtotal: 200, tax: 16, totalCost: 216 },
  );
});

test("computeQuoteTotals: totalCost uses the UNROUNDED subtotal", () => {
  // Regression from the source: `_ = N + S` is unrounded when tax and total are
  // derived, so subtotal + tax !== totalCost is expected behaviour.
  const t = computeQuoteTotals({ materials: [{ totalPrice: 0.575 }], labor: null });
  assert.equal(t.subtotal, 0.57);
  assert.equal(t.tax, 0.05);
  assert.equal(t.totalCost, 0.63);
  assert.notEqual(t.subtotal + t.tax, t.totalCost);
});

test("computeQuoteTotals: second divergence case, 0.205", () => {
  const t = computeQuoteTotals({ materials: [{ totalPrice: 0.205 }], labor: null });
  assert.equal(t.subtotal, 0.21);
  assert.equal(t.tax, 0.02);
  assert.equal(t.totalCost, 0.22);
});

test("computeQuoteTotals: negative totals propagate", () => {
  assert.deepEqual(
    computeQuoteTotals({ materials: [{ totalPrice: -100 }], labor: null }),
    { subtotal: -100, tax: -8, totalCost: -108 },
  );
});

test("computeQuoteTotals: negative materials offset positive labor", () => {
  assert.deepEqual(
    computeQuoteTotals({
      materials: [{ totalPrice: -50 }, { totalPrice: -50 }],
      labor: { totalCost: 100 },
    }),
    { subtotal: 0, tax: 0, totalCost: 0 },
  );
});

test("computeQuoteTotals: labor totalCost 0 contributes nothing", () => {
  assert.deepEqual(
    computeQuoteTotals({ materials: [{ totalPrice: 50 }], labor: { totalCost: 0 } }),
    { subtotal: 50, tax: 4, totalCost: 54 },
  );
});

test("computeQuoteTotals: raw truthy labor leaks into the arithmetic", () => {
  // totalCost: true passes the truthiness guard, is not a string, so it is not
  // converted. 50 + true === 51.
  assert.deepEqual(
    computeQuoteTotals({ materials: [{ totalPrice: 50 }], labor: { totalCost: true } }),
    { subtotal: 51, tax: 4.08, totalCost: 55.08 },
  );
});

test("computeQuoteTotals: does not mutate its input", () => {
  const materials = [{ totalPrice: 10 }];
  const labor = { totalCost: 5 };
  const snapshot = JSON.stringify({ materials, labor });
  computeQuoteTotals({ materials, labor });
  assert.equal(JSON.stringify({ materials, labor }), snapshot);
});

/* -------------------------------------------------------------------------- */
/* Payment                                                                     */
/* -------------------------------------------------------------------------- */

test("balanceDue: prefers amount_due", () => {
  assert.equal(balanceDue({ amount_due: 50, total_cost: 100 }), 50);
});

test("balanceDue: falls back to total_cost on falsy amount_due", () => {
  // A legitimate 0 balance falls through — observed quirk, preserved.
  assert.equal(balanceDue({ amount_due: 0, total_cost: 100 }), 100);
  assert.equal(balanceDue({ amount_due: null, total_cost: 100 }), 100);
  assert.equal(balanceDue({ amount_due: undefined, total_cost: 100 }), 100);
});

test("balanceDue: zero when neither is present", () => {
  assert.equal(balanceDue({}), 0);
  assert.equal(balanceDue({ amount_due: 0, total_cost: 0 }), 0);
});

test("depositPercentage: only the literal \"deposit\" triggers it", () => {
  assert.equal(depositPercentage("deposit", 30), 30);
  assert.equal(depositPercentage("deposit", 0), 0);
  assert.equal(depositPercentage("full", 30), undefined);
  assert.equal(depositPercentage(undefined, 30), undefined);
  assert.equal(depositPercentage("Deposit", 30), undefined); // case-sensitive
});