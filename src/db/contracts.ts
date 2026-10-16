/**
 * Observed table contracts — PARTIAL, NOT SCHEMAS.
 *
 * EVIDENCE
 *   Derived mechanically from `.opencode/blueprints/handy_quoter_blueprint.json`
 *   (`blueprint.tables.discovered[*].columns_observed`), which itself records
 *   literal column names harvested from `.select("…")`, `.insert()`/`.update()`
 *   object literals, and `.eq()`/`.order()` filter arguments in
 *   index-BvjQI7i8.js.
 *
 * WHAT THIS IS
 *   An inventory of column NAMES the observed client actually referenced.
 *
 * WHAT THIS IS NOT — do not treat any of the following as known:
 *   - a complete schema. Every table here has almost certainly more columns.
 *   - nullability. Nothing establishes whether an observed column is nullable.
 *   - SQL types. Names like `total_cost` imply a numeric column; the artifact
 *     never states one.
 *   - primary keys, foreign keys, CHECK constraints, indexes, triggers, grants
 *   - enum completeness. Observed status strings are not the full domain.
 *   - Row Level Security policies (U-03), which are server-side and invisible
 *     to any client artifact.
 *
 * TYPING RULE
 *   Every field is optional and typed `unknown` unless the artifact provides
 *   direct evidence of a wider-than-`unknown` contract. Optionality is used
 *   deliberately: it encodes "we do not know whether this is nullable", and must
 *   NOT be read as "this column is nullable".
 *
 * Consumers must narrow before use. That is the point: the evidence does not
 * support a stronger promise.
 */

/**
 * A value whose type the evidence does not establish.
 *
 * Using this (rather than `any`) forces consumers to narrow, so a downstream
 * mistake surfaces at the type check instead of at runtime.
 */
export type Unobserved = unknown;

/**
 * WHY EVERY FIELD IS OPTIONAL — read this before using these types.
 *
 * An optional marker here does **NOT** mean "this column is nullable in SQL".
 * Nothing in a client artifact can establish SQL nullability: the bundle never
 * contains DDL, and a `.select()` list says nothing about a NOT NULL
 * constraint. A column typed `?` here is optional for two evidence-driven
 * reasons that must not be conflated:
 *
 *   1. INCOMPLETE FIELD COVERAGE. The contract covers only columns the observed
 *      client referenced. The real table almost certainly has more columns,
 *      and this type cannot represent them.
 *
 *   2. PARTIAL PROJECTION SHAPE. A given `.select("…")` returned a subset of
 *      the table. A column absent from one response does not mean it is absent
 *      from the table, nor that it is NULL in that row.
 *
 * The VALUE TYPE remains `unknown` regardless, and at runtime the value may be
 * `null`, a string, a number, a boolean, an array, or an object — nothing was
 * observed. Treat `?` as "this project has not characterised this field", not
 * as "the database permits NULL".
 *
 * Practical consequence: never generate a NOT NULL assertion, a required-field
 * check, or an exhaustive field list from these types.
 */

/** Marker for "this contract covers only columns the client referenced". */
export type ObservedContract<Row> = {
  readonly [K in keyof Row]?: Row[K];
} & {
  /** Phantom marker; never present at runtime. */
  readonly __observedContract?: never;
};

/* -------------------------------------------------------------------------- */
/* jobs — 13 observed columns, 29 references                                   */
/* -------------------------------------------------------------------------- */

export interface JobsObservedRow {
  /** Join key into customers. Relationship is INFERRED from a PostgREST alias. */
  customer_id?: Unobserved;
  created_at?: Unobserved;
  description?: Unobserved;
  /** Value domain UNKNOWN — see `OBSERVED_STATUS_LITERALS` (non-exhaustive). */
  estimated_price?: Unobserved;
  id?: Unobserved;
  /** Value domain UNKNOWN. */
  priority?: Unobserved;
  scheduled_date?: Unobserved;
  /** Observed in .select(); value domain UNKNOWN. */
  status?: Unobserved;
  title?: Unobserved;
  tools_recommendations?: Unobserved;
  tutorial_links?: Unobserved;
  updated_at?: Unobserved;
  user_id?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* customers — 15 observed columns, 14 references                             */
/* -------------------------------------------------------------------------- */

export interface CustomersObservedRow {
  address?: Unobserved;
  amount_due?: Unobserved;
  amount_paid?: Unobserved;
  created_at?: Unobserved;
  customer_name?: Unobserved;
  email?: Unobserved;
  id?: Unobserved;
  job_title?: Unobserved;
  name?: Unobserved;
  notes?: Unobserved;
  /** Value domain UNKNOWN. */
  payment_status?: Unobserved;
  phone?: Unobserved;
  scheduled_date?: Unobserved;
  total_cost?: Unobserved;
  updated_at?: Unobserved;
  user_id?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* profiles — 23 observed columns, 17 references                              */
/* -------------------------------------------------------------------------- */

export interface ProfilesObservedRow {
  amount?: Unobserved;
  business_name?: Unobserved;
  customer_email?: Unobserved;
  customer_name?: Unobserved;
  deposit_percentage?: Unobserved;
  due_date?: Unobserved;
  first_name?: Unobserved;
  has_paid_plan?: Unobserved;
  id?: Unobserved;
  /** Observed in .select(); value domain UNKNOWN. */
  is_active?: Unobserved;
  is_admin?: Unobserved;
  job_title?: Unobserved;
  last_name?: Unobserved;
  onboarding_completed?: Unobserved;
  payments_enabled?: Unobserved;
  profile_image_url?: Unobserved;
  quote_id?: Unobserved;
  stripe_connect_account_id?: Unobserved;
  stripe_connect_onboarded?: Unobserved;
  subscribed?: Unobserved;
  /** Observed in .select(); value domain UNKNOWN. */
  subscription_end?: Unobserved;
  /** Observed; value domain UNKNOWN beyond the single literal "deposit". */
  subscription_tier?: Unobserved;
  user_id?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* quote_history — 15 observed columns, 10 references                         */
/* -------------------------------------------------------------------------- */

/**
 * Numeric-looking columns of quote_history.
 *
 * ⚠️ THE WIRE DOMAIN IS **NOT ESTABLISHED**. These fields are typed `unknown`.
 *
 * What the artifact DOES show (both observations are `SEEN`):
 *
 *  1. The quote editor coerces its own form state:
 *       typeof r.subtotal === "string" ? parseFloat(r.subtotal) || 0 : r.subtotal || 0
 *     where `r` is the editor's `quote` PROP. HTML `<input type="number">`
 *     yields strings, so this is tolerance for CLIENT INPUT.
 *
 *  2. The database READ path performs arithmetic on these fields with NO
 *     coercion at all:
 *       reduce((c,u) => c + ((u.amount_due || 0) - (u.amount_paid || 0)), 0)
 *     and maps rows into form state unchanged: `subtotal: _.subtotal`.
 *
 * Observation 2 points the OPPOSITE way from a `number | string` claim: if the
 * server returned strings, that reduce would concatenate rather than subtract,
 * and the client would be visibly broken. It is not broken, so the wire values
 * are *consistent with* numbers.
 *
 * "Consistent with" is NOT "established". No column type, and no PostgREST
 * numeric/string serialisation behaviour, was observed. An earlier draft of this
 * file typed these as `number | string`, which asserted an exhaustive wire
 * domain from a client-side coercion expression. That was an over-claim and has
 * been reverted to `unknown`.
 *
 * Consumers must narrow before use. See `NUMERIC_WIRE_TYPE_INFERENCE` for the
 * documented inference and its basis, so a future authorised source can settle
 * it rather than re-deriving it.
 */
export const NUMERIC_WIRE_TYPE_INFERENCE = {
  claim:
    "HYPOTHESIS, not established: quote_history." +
    "{subtotal,tax,total_cost,amount_paid,amount_due} are numeric on the wire",
  classification: "INFERRED — not SEEN",
  basis:
    "The read path sums and subtracts these fields with no string coercion " +
    "(`c + ((u.amount_due||0) - (u.amount_paid||0))`), which would concatenate " +
    "if the values were strings. The client is not observed to be broken.",
  contradicting_evidence:
    "The quote editor coerces the same fields for its form state, proving the " +
    "client tolerates strings — but that is input tolerance, not a wire claim.",
  unresolved_by:
    "Requires U-02 (DDL) or an authorised schema source, neither of which exists.",
} as const;

export interface QuoteHistoryObservedRow {
  amount_due?: Unobserved;
  amount_paid?: Unobserved;
  created_at?: Unobserved;
  /** Join key into jobs. Relationship is INFERRED from a PostgREST alias. */
  job_id?: Unobserved;
  job_description?: Unobserved;
  /** Observed as an object literal, defaulted with `|| {}`. */
  labor?: Unobserved;
  materials?: Unobserved;
  /** Value domain UNKNOWN. */
  payment_status?: Unobserved;
  /** Receives the camelCase client quote object; structure UNKNOWN. */
  raw_quote?: Unobserved;
  subtotal?: Unobserved;
  tax?: Unobserved;
  total_cost?: Unobserved;
  user_id?: Unobserved;
  /** Monotonic version observed in .order()/filters; value domain UNKNOWN. */
  version?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* marketing_leads — 10 observed columns, 2 references                        */
/* -------------------------------------------------------------------------- */

export interface MarketingLeadsObservedRow {
  created_at?: Unobserved;
  email?: Unobserved;
  /** Value domain UNKNOWN. */
  lead_type?: Unobserved;
  message?: Unobserved;
  name?: Unobserved;
  source?: Unobserved;
  subject?: Unobserved;
  utm_campaign?: Unobserved;
  utm_medium?: Unobserved;
  utm_source?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* leads — 8 observed columns, 1 reference                                    */
/* -------------------------------------------------------------------------- */

export interface LeadsObservedRow {
  email?: Unobserved;
  industry?: Unobserved;
  /** Free-form object literal; structure UNKNOWN. */
  metadata?: Unobserved;
  /** reCAPTCHA score from the verify-recaptcha edge function. */
  recaptchaToken?: Unobserved;
  source?: Unobserved;
  sessionId?: Unobserved;
  timestamp?: Unobserved;
  userAgent?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* scheduled_reddit_posts — 7 observed columns, 3 references                  */
/* -------------------------------------------------------------------------- */

/** Publishing through this table drives the CRITICAL post-to-reddit function. */
export interface ScheduledRedditPostsObservedRow {
  content?: Unobserved;
  id?: Unobserved;
  /** Value domain UNKNOWN. */
  post_type?: Unobserved;
  scheduled_for?: Unobserved;
  subreddit?: Unobserved;
  title?: Unobserved;
  user_id?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* landing_page_visitors — 5 observed columns, 1 reference                    */
/* -------------------------------------------------------------------------- */

export interface LandingPageVisitorsObservedRow {
  page_path?: Unobserved;
  referrer?: Unobserved;
  session_id?: Unobserved;
  user_agent?: Unobserved;
  visitor_id?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* ml_predictions — 3 observed columns, 1 reference                           */
/* -------------------------------------------------------------------------- */

export interface MlPredictionsObservedRow {
  id?: Unobserved;
  /** Value domain UNKNOWN. */
  prediction_type?: Unobserved;
  quote_accepted?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* ml_quote_analytics — 1 observed column, 1 reference                         */
/* -------------------------------------------------------------------------- */

/**
 * Only `id` was ever observed. The real table is almost certainly wider; this
 * contract is close to empty and should be treated as such.
 */
export interface MlQuoteAnalyticsObservedRow {
  id?: Unobserved;
}

/* -------------------------------------------------------------------------- */
/* Registry                                                                    */
/* -------------------------------------------------------------------------- */

/** The ten table names observed in the bundle. NOT the full table inventory. */
export type ObservedTableName =
  | "jobs"
  | "profiles"
  | "customers"
  | "quote_history"
  | "marketing_leads"
  | "leads"
  | "scheduled_reddit_posts"
  | "landing_page_visitors"
  | "ml_predictions"
  | "ml_quote_analytics";

/**
 * Status literals observed anywhere in the bundle.
 *
 * ⚠️ This is NOT the enum domain. A broadened sweep (case variants, plurals,
 * status/state/type/kind/stage/step/mode/tier/plan/level) found no additional
 * values, but a negative literal sweep does not prove absence. Completeness
 * remains UNKNOWN (U-06). Do not use this as a closed union.
 */
export const OBSERVED_STATUS_LITERALS = [
  "completed",
  "overdue",
  "paid",
  "partial",
  "pending",
  "unpaid",
] as const;

export type ObservedStatusLiteral = (typeof OBSERVED_STATUS_LITERALS)[number];

/** Only literal observed anywhere; the full payment_type domain is UNKNOWN. */
export const OBSERVED_DEPOSIT_PAYMENT_TYPE = "deposit" as const;

/** Row type for a given observed table. */
export type ObservedRow<Table extends ObservedTableName> = Table extends "jobs"
  ? JobsObservedRow
  : Table extends "profiles"
    ? ProfilesObservedRow
    : Table extends "customers"
      ? CustomersObservedRow
      : Table extends "quote_history"
        ? QuoteHistoryObservedRow
        : Table extends "marketing_leads"
          ? MarketingLeadsObservedRow
          : Table extends "leads"
            ? LeadsObservedRow
            : Table extends "scheduled_reddit_posts"
              ? ScheduledRedditPostsObservedRow
              : Table extends "landing_page_visitors"
                ? LandingPageVisitorsObservedRow
                : Table extends "ml_predictions"
                  ? MlPredictionsObservedRow
                  : MlQuoteAnalyticsObservedRow;

/**
 * Observed columns per table, for runtime inspection and drift detection.
 * Keys are exactly the names in the Phase A blueprint.
 */
export const OBSERVED_COLUMNS = {
  jobs: [
    "id", "title", "customer_id", "status", "priority", "estimated_price",
    "description", "created_at", "updated_at", "scheduled_date", "user_id",
    "tools_recommendations", "tutorial_links",
  ],
  customers: [
    "id", "name", "address", "email", "phone", "user_id", "customer_name",
    "job_title", "total_cost", "amount_paid", "amount_due", "payment_status",
    "scheduled_date", "notes", "updated_at",
  ],
  profiles: [
    "id", "business_name", "first_name", "last_name", "profile_image_url",
    "stripe_connect_account_id", "stripe_connect_onboarded", "payments_enabled",
    "onboarding_completed", "subscription_tier", "subscription_end",
    "has_paid_plan", "is_admin", "is_active", "subscribed", "quote_id",
    "amount", "payment_type", "deposit_percentage", "due_date",
    "customer_email", "customer_name", "job_title",
  ],
  quote_history: [
    "id", "job_id", "version", "created_at", "materials", "labor", "subtotal",
    "tax", "total_cost", "payment_status", "amount_paid", "amount_due",
    "job_description", "raw_quote", "user_id",
  ],
  marketing_leads: [
    "name", "email", "lead_type", "subject", "message", "source",
    "utm_source", "utm_medium", "utm_campaign", "created_at",
  ],
  leads: [
    "email", "source", "industry", "metadata", "timestamp", "userAgent",
    "sessionId", "recaptchaToken",
  ],
  scheduled_reddit_posts: [
    "id", "title", "content", "subreddit", "post_type", "scheduled_for", "user_id",
  ],
  landing_page_visitors: ["visitor_id", "user_agent", "referrer", "page_path", "session_id"],
  ml_predictions: ["id", "prediction_type", "quote_accepted"],
  ml_quote_analytics: ["id"],
} as const satisfies Record<ObservedTableName, readonly string[]>;

/**
 * Insert payload shapes observed in the bundle.
 *
 * These are the columns the CLIENT writes on that code path — not a constraint
 * set. No server-side requirement, default, or NOT NULL has been established.
 */
export const OBSERVED_INSERT_SHAPES = {
  quote_history: [
    "user_id", "job_description", "materials", "labor", "subtotal", "tax",
    "total_cost", "notes", "raw_quote", "version",
  ],
  landing_page_visitors: ["user_agent", "referrer", "page_path", "session_id"],
  scheduled_reddit_posts: ["title", "content", "post_type", "scheduled_for", "user_id"],
  marketing_leads: ["name", "email", "subject", "message"],
  leads: ["source", "industry", "metadata", "timestamp"],
} as const satisfies Partial<Record<ObservedTableName, readonly string[]>>;

/** Number of tables the client referenced. NOT the database's table count. */
export const OBSERVED_TABLE_COUNT = 10;

/** The table inventory remains incomplete — unreferenced tables leave no trace. */
export const COMPLETE_TABLE_INVENTORY: false = false;