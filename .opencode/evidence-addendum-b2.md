# Evidence Addendum B2 — Static Deepening

**Date:** 2026-10-15
**Authorization:** Static, local-only. No live-target request, no database access,
no authentication experiment.
**Provenance:** `JS_BUNDLE` (REA Evidence) and `JS_BUNDLE_STRING_SCAN` (shell),
kept distinct throughout.
**Phase A blueprint at `e8c0e9c` is unmodified.** This document records
subsequent findings.

---

## 1. Correction to Phase A — REA *did* extract endpoints

Phase A concluded:

> *"REA's endpoint and request extractors returned zero results on this minified
> single-file bundle… route and payload discovery rests on string scanning, which
> is not REA Evidence."*

**That was wrong.** The application graph contains **58 `endpoint` nodes and 16
`storage` nodes**, extracted by REA with `JS_BUNDLE` provenance.

The error was mine, not REA's. I queried `inspect_analysis_view` with
`collection: "modules"` and read 27 nodes — all `javascript-module` and
`javascript-asset`. I never queried the endpoint or storage collections, and I
inferred "zero endpoints" from a semantic-graph *request-family* count that was
separately zero.

Consequences:

- The route table and storage inventory below are **REA-backed evidence**, not
  string-scan results. Provenance is upgraded accordingly.
- `semantic_graph.coverage.families.request` retains **0 relations** — that part
  of Phase A was correct and still is. REA extracted endpoints from the
  application graph but request relations from the semantic graph, and the latter
  produced nothing. Both statements are true and were conflated.

---

## 2. Required classification distinctions

### 2.1 Literal storage reference vs. verified backend bucket

| Established | Not established |
|---|---|
| Client code contains `storage.from("profile-images")` — bucket **name** referenced in client source | That a bucket named `profile-images` exists in the Supabase project |
| Client calls `.upload(` (1 site) and `.getPublicUrl(` (1 site) | That those calls succeed, or that the bucket is publicly readable |
| REA `storage` nodes record `mechanism=call:storage.from` | Server-side bucket configuration, policies, or existence |

**Tag: `SEEN` (client reference) / `UNKNOWN` (backend existence).**

### 2.2 Statically declared Realtime subscription vs. verified runtime subscription

| Established | Not established |
|---|---|
| `.channel("customers-changes")` declared — 1 site | That the channel connects at runtime |
| `postgres_changes` subscription type declared — 9 sites | The table/filter payload actually subscribed |
| `.subscribe()` activation — 2 sites | Any frame received; REA recorded no websocket evidence |

**Tag: `SEEN` (declaration) / `UNKNOWN` (runtime frames).**

### 2.3 Observed query keys vs. demonstrably exhaustive inventory

29 `queryKey` sites were recovered, including 14 distinct key shapes. That is a
**non-exhaustive sample**, not an inventory:

- Keys assembled dynamically or consumed by library code are not enumerable statically
- A negative sweep proves nothing about the full cache-key space

**Tag: `SEEN` for the 29 observed; completeness `UNKNOWN`.** Must not be
described as "the query-key inventory."

### 2.4 OAuth invocation vs. identified, operational provider configuration

`signInWithOAuth` appears **once**. Hostnames `apple.com`, `github.com`,
`google.com`, `twitter.com` are present but ambiguous — OAuth config and plain
social/marketing links are indistinguishable from the literal alone. No
provider ID, redirect URI, or client registration was isolated.

**Tag: `SEEN` (an OAuth code path exists) / `UNKNOWN` (which provider, and
whether it is configured).**

---

## 3. Client route table — 40 routes, REA + static, `SEEN`

Identical from both sources (REA endpoint nodes, `mechanism=property:path`; and
static `path:"…"` literals). Parameterised routes are marked.

```
/                     /about            /analytics         /auth
/bathroom-contractors /blog             /blog/:slug  *     /comparison
/content-hub          /customers        /dashboard         /delete-account
/demo                 /embed/:widgetType /gamesummary      /how-to
/hvac-contractors     /index.html       /industry-fit      /intake/:userId
/kitchen-contractors  /landing          /legal             /login
/pay/:invoiceId       /pay/cancel       /pay/success       /payment-success
/phone-demo           /privacy          /reports           /reset-password
/revenue              /roi-calculator   /signup            /splash
/support              /trades           /try-demo          /voice-quote
```

`*` catch-all present. `*` was observed in the REA endpoint set but did not
appear in the static `path:"…"` sweep — it is declared by a different mechanism
(not a `path:` property). Both are recorded.

Coverage note: both methods are static and both are bounded by the same artifact.
Their agreement raises confidence but does **not** establish completeness of the
route table.

---

## 4. Storage inventory — REA `storage` nodes, `SEEN`

16 nodes. Medium is **mixed**, refining Phase A's `INFERRED localStorage`:

| Medium | Keys observed |
|---|---|
| `local-storage` | `intake_section_variant`, `demoCompleted`, `demoSession`, `isLoggedIn`, `visitor_id`, `supabase.auth.token`, `supabase.gotrue-js.locks.debug`, `sb-fmfyvplvutcusvxvymxj-auth-token`, plus 4 unnamed sites |
| `session-storage` | `splash-shown`, `session_id` |
| `indexed-db` | **`Disc`** — `window.indexedDB.open("Disc")` |

`Disc` is new and was absent from Phase A. Named storage operations are
`setItem` / `getItem` / `removeItem` / `open`.

Several nodes record `name=None` — the key is computed at runtime. Phase A's
key list was therefore never exhaustive.

---

## 5. Pricing arithmetic — `SEEN` (upgraded from Phase A `INFERRED`)

Phase A recorded the arithmetic as an unvalidated naming-convention inference.
**Actual expressions were located.** All offsets are into
`index-BvjQI7i8.js`.

| Quantity | Observed expression | Source location |
|---|---|---|
| labor total | `totalCost: hours * hourlyRate`, labour object `{hours, hourlyRate, totalCost}` | near `function:4825:5451` region |
| subtotal | `subtotal: Math.round(_ * 100) / 100` where `_ = N + S` (materials + labour) | line-2 column ~18k region |
| tax | `C = Math.round(_ * 0.08 * 100) / 100` → **rate is 8%** | same region |
| total | `E = Math.round((_ + C) * 100) / 100` | same region |
| amount_due | `amount_due: v.amount_due \|\| v.total_cost \|\| 0` | 2 sites |
| deposit | `deposit_percentage: payment_type === "deposit" ? de : undefined` | 2 sites |

**Reconstruction:**
```
laborTotal   = hours × hourlyRate
subtotal     = round2(materialsTotal + laborTotal)
tax          = round2(subtotal × 0.08)
totalCost    = round2(subtotal + tax)
amountDue    = amount_due ?? totalCost ?? 0
```

Confidence: high for the four core expressions — these are literal arithmetic,
not naming conventions. `materialsTotal`'s own accumulation loop was **not**
located; `N` is computed upstream and its derivation remains `UNKNOWN`.

---

## 6. `quote_history` write shape — `SEEN` (U-05 advanced)

Write site (3 identical occurrences):

```js
.from("quote_history").insert({
  user_id, job_description, materials, labor,
  subtotal, tax, total_cost, notes, raw_quote, version
}).select().single()
```

Field mapping is explicit at the write boundary:

| DB column | Source expression |
|---|---|
| `job_description` | `l.jobDescription` |
| `total_cost` | `l.totalCost` |
| `raw_quote` | `l.rawQuote` |
| `materials` | `l.materials \|\| []` |
| `labor` | `l.labor \|\| {}` |

Read sites map back to camelCase: `job_description → jobDescription`,
`total_cost → totalCost`, `raw_quote → rawQuote`.

`raw_quote` receives the **camelCase client-side quote object**, not the
snake_case DB row. Its full structure is still `UNKNOWN`.

---

## 7. Insert payload signatures — 5 distinct, `SEEN`

Complete mutation shapes recovered by sweep across all tables:

| Target | Insert payload |
|---|---|
| `quote_history` | `user_id, job_description, materials, labor, subtotal, tax, total_cost, notes, raw_quote, version` |
| `landing_page_visitors` | `user_agent, referrer, page_path, session_id` |
| `scheduled_reddit_posts` | `title, content, post_type, scheduled_for, user_id` |
| `marketing_leads` | `name, email, subject, message` |
| `leads` | `source, industry, metadata, timestamp` |

These are **write shapes only**. No update or upsert payload was recovered.

---

## 8. Evidence confidence — the graph's own numbers

These govern how much weight §3–§7 can carry.

| Measure | Value |
|---|---|
| Application-graph edges | 137 |
| Edges with `authority: static-relationship-inference` | **131 (95.6%)** |
| Edges with `state: inferred` | **131 (95.6%)** |
| Edges with `state: observed` | 6 (4.4%) |
| Edges with `coverage: partial` | 109 (79.6%) |
| Endpoint edges | 65 |
| Storage edges (`persists_to`) | 31 |
| Endpoint/storage nodes with identity strategy | `observation-fingerprint` / `artifact-local-key` |
| Graph coverage status | `partial` |

**Consequence:** the endpoint and storage nodes are individually `SEEN`
observations, but the **relationships** binding them to modules are overwhelmingly
`INFERRED`. Route → module ownership and storage-key → code-site mapping must be
carried at `INFERRED` confidence, not `SEEN`.

---

## 9. The 80,324 semantic unknowns — analysed, and they are ceiling artifacts

| Property | Value |
|---|---|
| Total | 80,324 |
| `object-flow` / `ambiguous-target` | 43,557 |
| `call-flow` / `dynamic-call` | 23,065 |
| `data-flow` / `unknown-value` | 11,454 |
| `object-flow` / `dynamic-property` | 2,211 |
| **Zero candidate node IDs (unattachable)** | **68,870 (85.7%)** |
| Exactly one candidate | 11,454 |
| Attachable to a node | 37,219 (46.3%) |
| …anchored to a **call-site** node | **0** |

Semantic nodes: 23,283 (function 8,979 / binding 7,302 / parameter 4,199 /
expression 2,092 / call-site 312 / property-slot 210). 99.1% carry a
`source_range`.

**`index-BvjQI7i8.js` retained exactly 20,000 nodes — the per-file ceiling.**
That single fact explains the bulk of the unknown population: analysis stopped,
not that information was hidden.

### Limitation on further mining

Semantic node identities are **byte-offset based and minified**
(`callable:function:6040:6305`, `property:["scope:function:4825:5451…`). They
convey structure and location, never semantic names. Mining these unknowns
further would add topology, not readable identifiers.

**Conclusion: the unknown population has low marginal value.** It is a ceiling
artifact, not an evidence reservoir. Treating it as "unreviewed gold" would be
a misreading of REA's own coverage report.

---

## 10. Static return shapes — complete coverage, unknown values

REA reports four exports with `return_shape_coverage.status: "complete"` and
`projection_complete: true`. Inspecting the content:

| Export | `value_status` | Stated reason |
|---|---|---|
| `b` | `unknown` | "This property may have been mutated." |
| `g` | `ambiguous` | "Branches have incompatible values." |
| `_` | `unknown` | "Unsupported CallExpression value." |
| `W`, `VoiceRecorderWeb` | *(no return sites)* | classes |

**`status: complete` refers to return-site coverage, not to a known value.** All
three function shapes resolve to an unknown value. Anyone reading
`projection_complete: true` as "the return type is known" would be wrong.

---

## 11. Item register — updated positions

| ID | Phase A | Now | Basis |
|---|---|---|---|
| U-01 edge function implementations | `UNKNOWN` | `UNKNOWN` | Unchanged. Static analysis cannot observe server logic. |
| U-02 schema DDL | `UNKNOWN` | `UNKNOWN` | Unchanged. Client literals still not DDL. |
| U-03 RLS policies | `UNKNOWN` | `UNKNOWN` | Unchanged. Not observable from artifacts. |
| U-04 complete table list | `UNKNOWN` | `UNKNOWN` | Unchanged. Unreferenced tables leave no trace. |
| U-05 `raw_quote` shape | `UNKNOWN` | `UNKNOWN` (advanced) | Write shape and field mapping `SEEN`; stored value still unknown. |
| U-06 enum domains | `UNKNOWN` | `UNKNOWN` | Broadened sweep found no new values; §12. |
| U-07 storage buckets | `UNCHECKED` | `SEEN` (client ref) / `UNKNOWN` (backend) | §2.1 |
| U-08 realtime | `UNCHECKED` | `SEEN` (declaration) / `UNKNOWN` (frames) | §2.2 |
| U-09 OAuth | `UNCHECKED` | `SEEN` (invocation) / `UNKNOWN` (provider) | §2.4 |
| U-10 query keys | `UNCHECKED` | `SEEN` (29 observed) / completeness `UNKNOWN` | §2.3 |

---

## 12. Negative result recorded honestly

A broadened enum sweep (case variants, plurals, `status`/`state`/`type`/`kind`/
`stage`/`step`/`mode`/`tier`/`plan`/`level`) returned **no new domain values**.
Matches were framework noise: `prototype`, `popstate`, `inputmode`, `edgemode`,
`scriptlevel`, `invalid_return_type`.

This does **not** establish that the six observed statuses are complete, nor that
no other statuses exist. A negative literal sweep is not proof of absence.
**U-06 remains `UNKNOWN`.**

---

## 13. Analysis that could not be performed reliably

| Attempted | Outcome |
|---|---|
| Derive semantic names from semantic-graph identities | Not possible — identities are byte offsets over minified code |
| Recover `materialsTotal` derivation (`N`) | Upstream accumulation loop not isolated |
| Enumerate all query keys exhaustively | Not possible statically; 29 observed is a sample |
| Identify OAuth provider from hostnames | Not possible — hostnames ambiguous with social links |
| Recover stored `raw_quote` value structure | Not present in any local artifact |
| Recover update/upsert payloads | None found; only insert shapes |
| Resolve 80,324 unknowns into readable structure | Rejected — ceiling artifact, offset-only identities (§9) |

---

## 14. Still required from authorized runtime evidence

Genuinely not obtainable from existing artifacts:

1. **U-01** — edge function implementations (all 22)
2. **U-02** — schema DDL beyond literal column names
3. **U-03** — RLS policy definitions
4. **U-04** — tables the client never references
5. **U-05** — stored `raw_quote` values
6. **U-06** — enum domains and constraints
7. **U-07 backend** — whether `profile-images` exists server-side
8. **U-08 runtime** — realtime frames
9. **U-09 provider** — OAuth provider identity
10. **U-10 completeness** — full query-key space

Items 1–4, 6, and 10 are gated on authorization (B-1, still open). Item 7 is a
single read-only check. Items 5, 8, 9 need an authenticated test account.

**Authorization boundary held. No live-target action taken.**