import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  COMPLETE_TABLE_INVENTORY,
  OBSERVED_COLUMNS,
  OBSERVED_DEPOSIT_PAYMENT_TYPE,
  OBSERVED_INSERT_SHAPES,
  OBSERVED_STATUS_LITERALS,
  OBSERVED_TABLE_COUNT,
  type ObservedRow,
  type ObservedTableName,
} from "../src/db/contracts.ts";

const here = dirname(fileURLToPath(import.meta.url));
const BLUEPRINT = join(here, "..", ".opencode", "blueprints", "handy_quoter_blueprint.json");

/* -------------------------------------------------------------------------- */
/* Drift guard — the contracts must match the committed Phase A blueprint      */
/* -------------------------------------------------------------------------- */

interface BlueprintTables {
  discovered: Array<{ name: string; references: number; columns_observed: string[] }>;
}

interface BlueprintShape {
  tables: BlueprintTables;
}

/** Read the committed Phase A blueprint. Everything nests under `blueprint`. */
const bp = (JSON.parse(readFileSync(BLUEPRINT, "utf8")) as { blueprint: BlueprintShape }).blueprint;

test("contracts: observed columns match the Phase A blueprint exactly", () => {
  for (const entry of bp.tables.discovered) {
    const name = entry.name as ObservedTableName;
    assert.ok(
      Object.prototype.hasOwnProperty.call(OBSERVED_COLUMNS, name),
      `${name} missing from OBSERVED_COLUMNS`,
    );
    const ours = [...OBSERVED_COLUMNS[name]].sort();
    const theirs = [...entry.columns_observed].sort();
    assert.deepEqual(ours, theirs, `column drift in ${name}`);
  }
});

test("contracts: no observed table is missing from the blueprint", () => {
  const blueprintTables = new Set(bp.tables.discovered.map((t) => t.name));
  for (const name of Object.keys(OBSERVED_COLUMNS)) {
    assert.ok(blueprintTables.has(name), `${name} is not in the blueprint`);
  }
});

test("contracts: table count and incompleteness markers are honest", () => {
  assert.equal(OBSERVED_TABLE_COUNT, bp.tables.discovered.length);
  assert.equal(Object.keys(OBSERVED_COLUMNS).length, OBSERVED_TABLE_COUNT);
  assert.equal(COMPLETE_TABLE_INVENTORY, false, "must not claim a complete inventory");
});

test("contracts: insert shapes cover only tables with an observed write path", () => {
  for (const table of Object.keys(OBSERVED_INSERT_SHAPES)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(OBSERVED_COLUMNS, table),
      `${table} has an insert shape but no column contract`,
    );
  }
});

test("contracts: observed status literals are a plain list, never a closed union", () => {
  // If this were typed as a closed union, consumers could exhaustively switch
  // and conclude the domain is complete. It is intentionally a readonly array
  // so `in` narrowing does not happen.
  assert.equal(OBSERVED_STATUS_LITERALS.length, 6);
  assert.ok(!OBSERVED_STATUS_LITERALS.includes("in_progress" as never));
  assert.equal(OBSERVED_DEPOSIT_PAYMENT_TYPE, "deposit");
});

/* -------------------------------------------------------------------------- */
/* Type-level assertions — compile-time only, so they live at module scope.   */
/* -------------------------------------------------------------------------- */

/** Fails the type check unless T is exactly true. */
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// A column the blueprint never observed must NOT be a key of the row type.
type HasBogus = "definitely_not_a_real_column" extends keyof ObservedRow<"jobs"> ? true : false;
type _noBogusColumn = Expect<Equal<HasBogus, false>>;

// A column the blueprint DID observe must be a key of the row type.
type QuoteHasJobId = "job_id" extends keyof ObservedRow<"quote_history"> ? true : false;
type _hasObservedColumn = Expect<Equal<QuoteHasJobId, true>>;

// Every row type must accept an empty object: nothing is claimed to be required.
type EmptyObject = Record<string, never>;

type JobsAcceptsEmpty = EmptyObject extends ObservedRow<"jobs"> ? true : false;
type _jobsOptional = Expect<Equal<JobsAcceptsEmpty, true>>;

type LeadsAcceptsEmpty = EmptyObject extends ObservedRow<"leads"> ? true : false;
type _leadsOptional = Expect<Equal<LeadsAcceptsEmpty, true>>;

// CoercibleNumber must be exactly `number | string`, and optional at the row level.
type SubtotalType = ObservedRow<"quote_history">["subtotal"];
type _subtotal = Expect<Equal<SubtotalType, number | string | undefined>>;

// Unobserved values must be `unknown`, forcing consumers to narrow.
type TitleType = ObservedRow<"jobs">["title"];
type _titleUnknown = Expect<Equal<TitleType, unknown>>;

test("types: compile-time contract assertions are evaluated by tsc, not at runtime", () => {
  // The assertions above are type-level; this test documents that the file
  // compiles only if they hold. If any failed, `tsc --noEmit` would error.
  assert.equal(true, true);
});

/* -------------------------------------------------------------------------- */
/* Runtime shape of the contracts                                              */
/* -------------------------------------------------------------------------- */

test("contracts: every table exposes a non-empty column list", () => {
  for (const [name, cols] of Object.entries(OBSERVED_COLUMNS)) {
    assert.ok(cols.length > 0, `${name} has no observed columns`);
  }
});

test("contracts: ml_quote_analytics is intentionally near-empty", () => {
  // Only `id` was ever observed; this must not be "filled in".
  assert.deepEqual([...OBSERVED_COLUMNS.ml_quote_analytics], ["id"]);
});

test("contracts: column names are unique within each table", () => {
  for (const [name, cols] of Object.entries(OBSERVED_COLUMNS)) {
    assert.equal(new Set(cols).size, cols.length, `duplicate column in ${name}`);
  }
});