# Evidence Addendum — Interpretive Distinctions

**Date:** 2026-10-15
**Type:** Documentation only. No evidence was altered, added, or removed.
**Status:** Governs interpretation of Phase A (`e8c0e9c`) and Phase B preflight (`317bfed`).

---

## Purpose

The Phase B preflight overreached in three places. This addendum records the
correct distinctions. It **supersedes specific phrases** in the preflight and
blueprint but **does not modify them** — Phase A evidence remains intact and
auditable.

No live-target request was made. No capture was executed. Authorization remains
pending.

---

## 1. Accessible PostgREST response ≠ complete schema DDL

### The distinction

A PostgREST OpenAPI response describes the database **as projected through the
requesting role's exposure**. It is a filtered view, not the schema.

What such a response can establish:

- Tables and views **visible to the requesting role**
- Column names and, for many types, inferred formats
- Enum value domains where the type is exposed through that role
- Relationship aliases, if configured

What it **cannot** establish:

- Tables hidden from the role by RLS, grants, or non-exposure — their existence is neither confirmed nor denied
- Primary keys, foreign keys, `CHECK` constraints, `NOT NULL`, defaults, indexes, triggers
- Row-Level Security policy definitions
- Sequence/identity definitions, generated columns, partitioning
- Anything about rows the role cannot read

### Why this matters

The preflight §4 stated that a single introspection request could "resolve U-02
(schema DDL)" and set acceptance criteria reading *"every table's columns/types
enumerated."*

That is not a valid acceptance criterion. **A complete enumeration returned by
PostgREST proves completeness of the accessible projection, not of the schema.**
The two must not be recorded as the same result.

### Corrected status semantics

| Observation | Correct tag |
|---|---|
| Table appears in the OpenAPI response | `SEEN` (this table, exposed to this role) |
| Table absent from the response | `UNKNOWN` — **never `ABSENT`**. Absence from a role-filtered projection is not proof the table does not exist. |
| Column appears in the projection | `SEEN` |
| Column absent from the projection | `UNKNOWN` |
| Enum values returned | `SEEN` for those values; `UNKNOWN` for completeness |

U-02 therefore **stays `UNKNOWN`** after introspection unless a privileged or
vendor-supplied source (SQL dump, `information_schema` access, or owner-provided
DDL) is used. Introspection can *narrow* U-02; it cannot close it.

---

## 2. Observed access outcome ≠ RLS policy definition

### The distinction

An **access outcome** is the result of one request: `200`, `403`, `401`, or `200`
with zero rows. It is a single observation of the database's behaviour at one
moment for one role on one table.

An **RLS policy definition** is a server-side SQL rule — `USING (...)`,
`WITH CHECK (...)`, the role it binds to, and the commands it covers. It is
configuration, not behaviour.

A `200` with zero rows is consistent with *at least four* different situations:

1. A restrictive `USING` clause that excludes the queried rows
2. A row genuinely absent from the table
3. A filter the client applied that matched nothing
4. A `LIMIT`/pagination interaction

Nothing in a single observation distinguishes them. Reaching a policy definition
requires reading the policy itself — via database access, `pg_policies`, or
owner documentation — **not** by sampling responses.

### Why this matters

The preflight §4 proposed resolving U-03 through "an exhaustive authorization
matrix probe" of live requests.

An authorization matrix — even a complete one — yields outcomes, not
definitions. It could characterize *behaviour under probing*, which is useful and
legitimate, but it must not be recorded as the RLS policy definition. It would be
both a category error and an aggressive probing exercise against a production
database.

### Corrected status semantics

- U-03 remains **`UNKNOWN`**. No traffic capture establishes policy definitions.
- An authorization matrix, if ever authorized and performed, would produce
  `SEEN` **access outcomes** under `RUNTIME_OBSERVED` provenance — never
  `SEEN` policy definitions.
- Only privileged database access or owner-supplied documentation resolves U-03.

---

## 3. Sourcemap unavailability at the inspected deployment ≠ permanent unavailability

### The distinction

What was established, and no more:

> On **2026-10-15**, at deployment **`https://www.handyquoter.com/`**, for the
> three artifacts named `index-BvjQI7i8.js`, `web-CTVV3Kh5.js`, and
> `index-Dg9DvioW.js` as served from `/assets/`: zero `sourceMappingURL`
> occurrences across the full file text of each, each file terminating on an
> `export{…}` statement, and each corresponding `.map` URL returning HTTP 404.

That is a complete, well-evidenced observation **of that deployment at that
time**. It is not a statement about the artifact's history, other deployments, or
the vendor's intentions.

Sources that could resolve U-11 under authorization:

- A non-minified or `development`-mode build
- Source maps from a staging or preview deployment
- Owner-supplied build artifacts or the upstream repository
- Vendor-provided maps for an earlier release

### Why this matters

The preflight used the language *"Not obtainable"*, *"Permanent unless vendor
supplies maps"*, and *"documented as permanently unresolved."*

Per the post-preflight directive: **do not label something permanently
unresolvable when another authorized evidence source could resolve it.** That
language is superseded. The accurate statement is *not observable at the
inspected deployment*.

### Corrected status

U-11 remains **`UNCHECKED`** — a surface not adequately examined — with the scope
of the negative search documented as above. It is not `ABSENT` (the deployment
genuinely lacks maps, but `ABSENT` in this taxonomy means proven non-existence,
which was never established), and it is not "permanent."

The same correction applies to **U-12** (Capacitor native surfaces): not
observable via the web bundle, resolvable from the native project or an
installed build.

---

## 4. Superseded phrases

| Location | Superseded phrase | Corrected |
|---|---|---|
| Preflight §4, U-02 row | "resolve U-02 (schema DDL)" / "every table's columns/types enumerated" | Narrows U-02 only. Accessible projection ≠ complete DDL. |
| Preflight §4, U-03 row | "exhaustive authorization matrix probe" | Yields access outcomes, not policy definitions. U-03 stays UNKNOWN. |
| Preflight §4, U-11 row | "Not obtainable — all `.map` 404" | Not observable at the inspected deployment; other authorized sources may resolve it. |
| Preflight §6 | "U-11, U-12 … permanently unresolved" | `UNCHECKED` with scoped negative search. Not permanent. |
| Blueprint line 54 | coverage `"complete - file tail inspected"` | Superseded by whole-file + HTTP evidence (see Phase B §1.5, D-4). Still an open documentation defect. |

---

## 5. Status of unresolved items — unchanged

All twelve retain their Phase A tags. Nothing is promoted.

| ID | Tag | Note |
|---|---|---|
| U-01 | `UNKNOWN` | 22 edge functions known by name and request shape only |
| U-02 | `UNKNOWN` | Accessible projection ≠ DDL |
| U-03 | `UNKNOWN` | Access outcomes ≠ policy definitions |
| U-04 | `UNKNOWN` | Unreferenced tables leave no client trace |
| U-05 | `UNKNOWN` | Stored blob shape not recovered from static analysis |
| U-06 | `UNKNOWN` | Observed literals do not establish the complete enum |
| U-07 | `UNCHECKED` | Pattern-bounded sweep; scope now documented |
| U-08 | `UNCHECKED` | App-level channel usage not separately extracted |
| U-09 | `UNCHECKED` | Narrow Phase A sweep |
| U-10 | `UNCHECKED` | Query keys not extracted |
| U-11 | `UNCHECKED` | Negative search scoped to one deployment (see §3) |
| U-12 | `UNCHECKED` | Web bundle only; native project not supplied |

---

## 6. Out of scope, reaffirmed

Not attempted and not to be attempted without separate explicit authorization:

- `verify-recaptcha` — access-control circumvention
- `create-connect-account`, `create-payment-link`, `post-to-reddit`,
  `process-reddit-posts` — classified CRITICAL in Phase B
- All email-sending, payment-creating, and content-publishing edge functions
- Authorization matrix probing of production tables

---

## 7. Provenance tiers

Phase A established two. This project will need a third for any future
authorized capture:

| Tier | Source | REA Evidence? |
|---|---|---|
| `JS_BUNDLE` | `analyze_javascript_application` structured analysis | yes |
| `JS_BUNDLE_STRING_SCAN` | regex over artifact bytes | **no** |
| `RUNTIME_OBSERVED` | authorized live capture *(not yet created)* | depends on tool |

Bundle string matches are **not** promoted into REA-backed evidence. Runtime
observations are distinct from static analysis, and neither is a substitute for
the other.

---

## 8. Static re-probe — four items advanced without any live access

A local re-probe of the already-downloaded artifacts
(`index-BvjQI7i8.js`, 1,911,788 bytes, sha256 `2e3bf0bc…2fd9`) recovered
evidence that Phase A missed. **No network request was made.** These remain
`JS_BUNDLE_STRING_SCAN` provenance — not REA-backed.

### 8.1 U-10 — queryKey structure: RESOLVED

29 `queryKey` sites recovered with full literal structure:

```
["jobs"]                                    ["jobs", userId]
["jobs", userId, t]                         ["customers"]
["customers-count"]                         ["customers-for-calling", customerId]
["customers-with-jobs"]                     ["customers-with-jobs", userId]
["customer-jobs", customerId]               ["customer-quote-history", jobId]
["dashboard-stats", userId]                 ["leads-count", userId]
["monthly-revenue", userId]
```

Cache invalidation scopes are now evident: bare `["jobs"]` vs user-scoped
`["jobs", userId]` are distinct keys. This resolves the query-key question
entirely from the static artifact.

### 8.2 U-07 — storage bucket: RESOLVED, **and a Phase A methodology error is corrected**

Phase A tagged buckets `UNCHECKED` and documented the sweep as
`.from().storage`. **That pattern is reversed** — Supabase storage is addressed
`storage.from("<bucket>")`. The Phase A sweep could not have found a bucket.

Correct sweep finds:

| Signal | Count | Value |
|---|---|---|
| `storage.from("…")` | 4 | **`profile-images`** |
| `.getPublicUrl(` | 1 | — |
| `.upload(` | 1 | — |
| `.createSignedUrl(` | 0 | not observed |
| `.list(` | 0 | not observed |

A storage bucket named `profile-images` **does exist**. Phase A's `UNCHECKED`
status was the safe outcome, but the underlying search was defective. Recorded
here rather than silently amended.

### 8.3 U-08 — realtime: APP-LEVEL USAGE RESOLVED

| Signal | Count | Value |
|---|---|---|
| `.channel("…")` | 1 | **`customers-changes`** |
| `postgres_changes` | 9 | subscription type |
| `POSTGRES_CHANGES` | 1 | enum member |
| `.subscribe()` | 2 | activation sites |

The app subscribes to Postgres changes on a `customers-changes` channel. Channel
identity and subscription type are now statically known. **Payload frames at
runtime remain unobserved** and would require capture.

### 8.4 U-09 — OAuth: PRESENCE CONFIRMED

`signInWithOAuth` appears once. OAuth support **exists**; Phase A's narrow sweep
missed it. The provider identity was not isolated — hostnames for
`apple.com`, `github.com`, `google.com`, `twitter.com` are present but are
ambiguous between OAuth config and plain social/marketing links. Provider
identification remains `UNCHECKED`.

### 8.5 U-05 — quote writer shape: PARTIALLY ADVANCED

Keys near the `saveQuoteToHistory` write site: `quote`, `labor`, `hours`,
`materials`. The **write-side** serialization shape is partially visible. Stored
values and their exact structure remain `UNKNOWN`.

### 8.6 Promotion is a separate, authorized action

The Phase A blueprint at `e8c0e9c` is a point-in-time record and has **not been
edited**. Promoting U-07, U-08, U-09, and U-10 requires a separate authorized
commit so that the Phase A evidence and its later correction remain separately
auditable.