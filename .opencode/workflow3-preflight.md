# Workflow 3 Preflight Audit — HandyQuoter Clean-Room

**Date:** 2026-10-15
**Phase:** B (preflight only — Workflow 3 NOT executed)
**Repo state verified at:** `e8c0e9c`
**Status:** Awaiting authorization. No live-target action was taken during this audit.

---

## 1. Artifact and Repository Verification

### 1.1 Git state — CONFIRMED

| Check | Expected | Actual | Result |
|---|---|---|---|
| HEAD | `e8c0e9c` | `e8c0e9c1d4f10da565d80b6568cf8947f484fef0` | MATCH |
| `origin/main` | `e8c0e9c` | `e8c0e9c1d4f10da565d80b6568cf8947f484fef0` | MATCH |
| Branch | `main` | `main` (tracking `origin/main`) | MATCH |
| Working tree | clean | clean, no untracked files | MATCH |

Tracked files (3): `README.md`, `.opencode/clean-room-spec.md`, `.opencode/blueprints/handy_quoter_blueprint.json`

### 1.2 Artifact paths

| Artifact | Path | Status |
|---|---|---|
| Phase A blueprint | `.opencode/blueprints/handy_quoter_blueprint.json` | PRESENT |
| Evidence manifest | **No standalone file.** Evidence reference is embedded at `.blueprint.evidence` (lines 38–45) | DISCREPANCY — see D-1 |
| Unresolved-items register | **No standalone file.** U-01…U-12 embedded at `.blueprint.unresolved_checklist.items` | DISCREPANCY — see D-1 |
| Workflow 3 implementation | **DOES NOT EXIST** | BLOCKER — see D-2 |

### 1.3 External evidence bundle — VERIFIED

```
/private/var/folders/pc/dw65b6ms18v0rqccj56h0h380000gn/T/opencode/hq-analysis/handy_quoter_evidence.json
```

| Check | Result |
|---|---|
| Exists | yes |
| Size | 92,159,169 bytes — matches blueprint's `exported_bundle_bytes` |
| Valid JSON | yes |
| Contains `ev_33aeae1a…` (parent analysis) | yes |
| Contains `ev_5cc6f2a0…` (analysis view) | yes |
| `sha256` | `2effe5213c8594bc2bdc87022bce2487dfb8d76f241ba9b3716f67fb135dfcbf` |
| In git | **No** — correctly excluded |

**D-3 (minor, unfixed):** the blueprint records the bundle's size but **not its SHA-256**. The digest above was computed during this audit and is not yet recorded anywhere. Recommend adding it to `.blueprint.evidence` for integrity. Not fixed here per "report first."

### 1.4 Bundle filename consistency — CONSISTENT

`index-BvjQI7i8.js` (capital `I`) appears at lines 50 and 75 — the two authoritative `artifacts[].path` entries.

The lowercase-`l` form appears exactly once, at line 74, inside `filename_correction.requested_name`. That is **intentional documentation of the wrong name that was supplied**, not an inconsistency.

Independently re-verified: the lowercase form returns HTTP 404; the capital form resolves.

### 1.5 Contradiction check — ONE DEFECT FOUND

**D-4 — sourcemap `ABSENT` tags violate the spec's own coverage rule.**

Blueprint lines 61 and 68 tag `web-CTVV3Kh5.js` and `index-Dg9DvioW.js` sourcemaps as `ABSENT` with **no `coverage` field at all**. Line 54 does carry coverage, but the wording `"complete - file tail inspected"` understates what was checked.

Per `.opencode/clean-room-spec.md` §1: *"ABSENT requires `coverage: "complete"`."*

The **conclusions are factually correct**. This audit re-verified independently:

- All three artifacts: zero `sourceMappingURL` occurrences, whole-file (not just tail)
- All three files terminate cleanly on an `export{…}` statement
- All three `.map` URLs return HTTP 404 from the server

So this is a **documentation defect, not a factual error**. Recommend (not applied): add `coverage` to lines 61/68 and reword line 54 to cite whole-file + HTTP evidence.

No other contradictions found. The spec, blueprint, and repo state are mutually consistent.

---

## 2. Workflow 3 — Execution Path Audit

### 2.1 Critical finding

**There is no Workflow 3 implementation to audit.** No `.ts`, `.js`, `.py`, `.sh`, or `package.json` exists anywhere in the repository. Workflow 3 exists only as three prose steps in `.opencode/clean-room-spec.md` §2.

What follows therefore describes the **proposed** execution path built from tooling that actually exists, not a trace of existing code.

### 2.2 Candidate execution paths

**Path A — REA controlled replay** (`capture_browser_scenario`)

Verified contract facts:

| Property | Value |
|---|---|
| Browser modes | `launch` (owned temp profile) or `connect` (loopback CDP + `target_id`) |
| Actions | `goto`, `click`, `fill`, `press`, `select_option`, `check`/`uncheck`, `wait_for`, `wait_for_timeout` — **declarative only**, `minItems: 1` |
| Auth injection | `storage.cookies` / `local_storage` / `session_storage`, values as `literal` or `secret` |
| Secret handling | `secrets: [{secret_id, environment_variable}]` — **values never supplied inline**, read from env; `redacted` flags on URLs and bodies |
| Output | REA Evidence with `steps[]`, `events[]`, `completeness`, `duration_ms` |
| Cleanup | `terminated-owned-process` (launch) or `disconnected-external` (connect) |
| Cancellation | per-step `timeout_ms`; harness-level cancellation supported |

**⚠️ Default-capture trap.** The tool captures almost nothing by default:

```
at_end      = ["url"]
after_each_step = []
events      = []
network     = { request_body: false, response_body: false, header_values: false }
```

Network bodies and header values are **off unless explicitly enabled**. A scenario run without a `capture` block will return URLs and nothing useful. Any plan must set `capture.network.{request_body,response_body,header_values} = true` and `capture.events = ["network"]`.

**⚠️ Output-format mismatch.** `capture_browser_scenario` returns structured REA Evidence events. It **does not write a HAR file.** `inspect_web_network_capture` consumes HAR/SAZ/qlog. These two tools **cannot be chained directly** — a conversion step would be required, or the REA Evidence is used as-is and `inspect_web_network_capture` is skipped for this target.

**Path B — OpenCode browser network tooling** (`tools.browser.network.list` / `.get`)

Live network inspection against the agent's own browser session. Convenient, but produces **OpenCode tool output, not REA Evidence** — it would be classified under the existing `JS_BUNDLE_STRING_SCAN`-style provenance tier, i.e. `is_rea_evidence: false`.

**Recommended:** Path A as primary (produces citable REA Evidence with built-in redaction), Path B only as a cross-check.

### 2.3 Ordered execution sequence (proposed)

```
1. Resolve target + ownership authorization        [BLOCKER — see §5]
2. Select browser mode
   2a. launch  → requires explicit executable_path; owned temp profile = NO existing session
   2b. connect → requires a running browser with --remote-debugging-port + target_id
3. Inject auth (if any) via storage{} using secret_id references to env vars
4. Execute declarative action sequence
5. Capture events: capture.events=["network"], network.{request_body,response_body,header_values}=true
6. REA returns Evidence (events[], steps[], completeness)
7. Filter to target-relevant transactions (supabase.co / edge functions)
8. Classify each observation: runtime-observed vs static-inferred
9. Write capture artifact OUTSIDE git (size + secrets)
10. Update blueprint U-items with new tag + provenance
11. Export evidence bundle before session close
```

### 2.4 Read-only vs. state-mutating operations

**Read-only (safe):**
`check-subscription`, `check-trial-status`, `check-webhook-health`, `get-business-profile`, `customer-portal` (creates a portal *session*, reversible)

**State-mutating (must not run in preflight):**
`send-contact-email`, `send-quote-email`, `post-to-reddit`, `process-reddit-posts`, `create-checkout`, `create-connect-account`, `create-payment-link`, `verify-ios-purchase`, all `generate-*` (likely persist), `transcribe-audio`

---

## 3. Side-Effect and Data-Exposure Risk Assessment

### 3.1 Per-function risk (22 edge functions)

| Function | Risk class | External effect | Severity |
|---|---|---|---|
| `create-connect-account` | Creates Stripe Connect account | **Real external account created** | CRITICAL |
| `post-to-reddit` | Publishes publicly to Reddit | **Irreversible public post; likely ToS breach** | CRITICAL |
| `process-reddit-posts` | Bulk Reddit publishing | Irreversible, public | CRITICAL |
| `send-quote-email` | Sends real email | External delivery to real address | HIGH |
| `send-contact-email` | Sends email + writes lead row | External delivery + prod DB write | HIGH |
| `create-payment-link` | Creates persistent Stripe object | Live payment object in account | HIGH |
| `create-checkout` | Creates Stripe Checkout session | Live Stripe object | HIGH |
| `verify-ios-purchase` | Hits Apple receipt API | External Apple call | MEDIUM |
| `verify-recaptcha` | Hits Google reCAPTCHA | **Anti-bot control** | MEDIUM |
| `generate-quote` | LLM + likely `jobs` write | Cost + PII to third-party model | MEDIUM |
| `transcribe-audio` | Transcription service | Cost + **biometric-adjacent PII** | MEDIUM |
| `generate-job-prep` | LLM | Cost | MEDIUM |
| `generate-seo-content` | LLM | Cost | MEDIUM |
| `generate-lead-magnet` | LLM + lead write | Cost + prod DB write | MEDIUM |
| `generate-outreach-emails` | LLM + lead write | Cost + prod DB write | MEDIUM |
| `find-backlink-opportunities` | LLM | Cost | MEDIUM |
| `generate-game-summary` | LLM | Cost | MEDIUM |
| `check-subscription` | Read | — | LOW |
| `check-trial-status` | Read | — | LOW |
| `check-webhook-health` | Read + Stripe API | — | LOW |
| `get-business-profile` | Read | Returns PII (name, email, phone, address) | LOW effect / MEDIUM exposure |
| `customer-portal` | Creates portal session | Reversible | LOW |

### 3.2 GET is not automatically safe

Explicitly per the directive: **do not assume a GET is harmless.**

- `get-business-profile` is a read but **exfiltrates customer PII** into Evidence.
- `customer-portal` is nominally navigational but mints a live Stripe session.
- PostgREST `GET /rest/v1/<table>` **is** read-only at the row level, but with the anon key its **row coverage depends entirely on RLS** — a read can still leak data if RLS is misconfigured. That is itself a finding, but it must not be *relied upon*.

### 3.3 Data exposure into artifacts

| Vector | Assessment |
|---|---|
| Authorization headers | `capture.network.header_values` defaults **false**; `redacted` flags exist. Safe **only if** secrets are registered in `secrets[]` |
| Supabase access/refresh tokens | Present in `Authorization` + `sb-…-auth-token` localStorage. `storage` capture would persist them |
| Cookies | Same |
| Customer PII | `get-business-profile` returns name, email, phone, address, project description |
| Stripe identifiers | `stripe_connect_account_id`, `payments_enabled` |
| Audio recordings | `transcribe-audio` — potentially biometric-adjacent |

**Mitigations required:**
1. Register every credential in `secrets[]` via env vars — never inline literals
2. Leave `header_values: false` unless a specific header is needed, then scope it
3. Capture `storage` artifacts **off** by default; turn on only if storage keys are the question (U-08)
4. Write all captures **outside** the git repo
5. Apply a redaction pass before any capture is committed

### 3.4 Bounded execution and cleanup

| Control | Status |
|---|---|
| Per-step timeout | Yes — `timeout_ms` per action |
| Overall timeout | Via `timeout_ms` + harness cancellation |
| Cleanup | Yes — `terminated-owned-process` / `disconnected-external` |
| Step-level failure isolation | Yes — steps carry `status: completed / failed / cancelled` with `error` |
| Completeness reporting | Yes — `completeness.status` + `missing_sections` + `truncated_sections` |
| Retries | **None.** No retry parameter exists. A retry is a new invocation. |
| Safe stop | Yes — cancellation drains the request; no retry to compound side effects |

**No automatic retry is a positive**: a failed mutating action will not be silently re-attempted.

---

## 4. Capture Matrix — U-01 … U-12

Priority: **A** = safe read-only, **B** = needs auth + approval, **C** = do not run.

| U-ID | Question | Proposed capture | Trigger | Auth | Priority | Side effects | Result tag | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| **U-02** | Schema DDL | `GET {supabase}/rest/v1/` with `apikey` + `Authorization: Bearer <anon>` | Unauthenticated landing visit | anon key only | **A** | None (read-only) | SEEN | OpenAPI doc returns; every table's columns/types enumerated; response retained with digest |
| **U-04** | Complete table list | Same OpenAPI response | Same | anon | **A** | None | SEEN | Table list obtained AND compared to the 10 observed in Phase A; any additional table noted |
| **U-06** | Enum domains | OpenAPI `definitions`/`components.schemas` enums | Same | anon | **A** | None | SEEN | Enum value lists returned. If absent → stays UNKNOWN, **not** ABSENT |
| **U-07** | Storage buckets | `GET {supabase}/storage/v1/bucket` | Same | anon | **A** | None | SEEN | Bucket list returned, or explicit empty list **with complete coverage** (else UNCHECKED) |
| **U-08** | Realtime channels | `capture_browser_scenario` on `/landing`, `capture.events=["network","websockets"]` | Page load | none | **A** | None | SEEN | Websocket frames or `/realtime/v1/websocket` subscription payload captured with channel/topic names |
| **U-09** | OAuth providers | Navigate to `/login`, capture redirect URIs only | Login page load | none | **A** | None | SEEN | OAuth provider hostnames observed in redirect URIs. Absence without complete coverage → UNCHECKED |
| **U-10** | React Query keys | Not resolvable via traffic | — | — | — | — | remains UNCHECKED | Requires U-11 |
| **U-11** | Source maps | **Not obtainable** — all `.map` 404 | — | — | — | — | remains UNCHECKED | Permanent unless vendor supplies maps or an unminified build |
| **U-12** | Capacitor native | Not web-resolvable | — | — | — | — | remains UNCHECKED | Requires the native project or installed app |
| **U-01** | Edge function implementations | Capture responses per function | Function-specific UI action | **Account required** | **B** | **Varies — see §3.1** | Mixed | Only for functions whose trigger is demonstrably non-mutating AND approved. Each response retained with digest |
| **U-01 subset** | `check-subscription` / `check-trial-status` | Invoke via UI on a **test account** | Subscription page view | test account | **B** | Reads subscription state only | SEEN | Response body captured; `hasAccess`/`subscribed`/`hasHadTrial` shapes confirmed with concrete values |
| **U-01 subset** | `verify-recaptcha` | **DO NOT RUN** | — | — | **C** | — | — | Anti-bot control. Automating it is circumventing an access control, which the directive forbids |
| **U-01 subset** | `post-to-reddit`, `process-reddit-posts` | **DO NOT RUN** | — | — | **C** | — | — | Irreversible public content publication |
| **U-01 subset** | `create-connect-account`, `create-checkout`, `create-payment-link` | **DO NOT RUN** | — | — | **C** | — | — | Creates live Stripe objects in a third-party account |
| **U-01 subset** | `send-*`, `generate-*`, `transcribe-audio` | **DO NOT RUN** | — | — | **C** | — | — | Email delivery, prod DB writes, third-party AI cost, PII egress |
| **U-03** | RLS policies | **Not resolvable by traffic capture** | — | — | — | — | remains UNKNOWN | Requires DB access or an exhaustive authorization matrix probe. Traffic capture cannot establish RLS |
| **U-05** | `quote_history.raw_quote` shape | Read one existing row on a **test account** | Quote history page | test account | **B** | None (read) | SEEN | A populated `raw_quote` value captured with its JSON structure |

### 4.1 Highest-value insight

**U-02 / U-04 / U-06 / U-07 may be resolvable from a single unauthenticated-or-anon-key read-only request** to the Supabase PostgREST root, which by PostgREST convention serves an OpenAPI description of the database.

This would resolve **four** of the twelve unknowns — including the largest (`U-02` schema DDL, currently blocked with no client-side path at all) — with **zero writes and no third-party effects**.

**This is a hypothesis, not an established fact.** It must be verified under authorization, and the acceptance criteria above govern whether it counts. If the response is empty or access is denied, these items **remain UNKNOWN** — they do not become ABSENT.

---

## 5. Blockers and Prerequisites

### B-1 — Ownership / authorization unresolved — **TOP BLOCKER**

The question *"is HandyQuoter yours, or a third-party product?"* was asked at the end of Phase A and **has not been answered.**

This is now materially more significant than it was for Phase A. Reading a public JS bundle is one thing. Introspecting a live database schema, calling edge functions, and exercising a production auth flow against **someone else's service** is a different activity with real authorization implications.

**Recommended alternative that removes the blocker entirely:** if access to a HandyQuoter **test/staging instance** or the **Supabase project owner's cooperation** can be arranged, every `B`-priority item becomes safe. A self-hosted or staging environment also lets us test mutating flows safely.

### B-2 — No Workflow 3 implementation exists

Any capture requires either authoring a script or driving tools interactively. Recommendation: interactive, one function at a time, with explicit authorization per function — not an unattended batch script. An unattended script against mutating endpoints is exactly the failure mode the directive is guarding against.

### B-3 — Browser executable path unknown

`capture_browser_scenario` in `launch` mode requires an explicit `executable_path`. macOS applications are bundles; the binary is inside. Needs resolution before any `launch`-mode run.

### B-4 — No test account

Every `B`-priority item requires authentication. Using a real contractor account would put **real customer data** into Evidence, which the directive forbids.

### B-5 — reCAPTCHA gating blocks the contact flow

`send-contact-email` requires a `recaptchaScore` from `verify-recaptcha`. Any automated reproduction of the contact flow necessarily circumvents an anti-bot control. This is classified **C — do not run**, and cannot be made safe by scoping alone.

### B-6 — Capture artifacts must stay outside git

Network captures with bodies and header values will contain tokens and PII. Default location for all captures: outside the repository working tree.

---

## 6. Recommendation

**Recommendation: PROCEED — but only with a narrowly scoped, read-only capture, and only after B-1 is resolved.**

Specifically:

1. **Resolve B-1 first.** This gates everything. If HandyQuoter is a third-party system and no authorization exists, **stop** — Phase A's static findings are already sufficient to describe the client contract, and the blueprint's `UNKNOWN` tags are the correct, honest terminal state for the server side.

2. **If authorized, run exactly one capture: the PostgREST schema introspection** (`U-02`, `U-04`, `U-06`, `U-07`). It is:
   - single HTTP request
   - read-only, no writes, no third-party effects
   - unauthenticated or anon-key only — **no test account needed** (clears B-4 for this step)
   - highest information yield of any option (4 unknowns)
   - fully reversible (nothing to undo)

3. **Then one unauthenticated `capture_browser_scenario`** on `/landing` for `U-08` (Realtime) and `U-09` (OAuth). Still read-only. Still no test account.

4. **Defer everything else.** All `C`-priority functions stay unrun. `U-01` beyond the two read-only subscription checks requires a test account and per-function sign-off.

5. **Accept that some unknowns are permanent.** `U-03` (RLS), `U-10`, `U-11`, `U-12` are not reachable by any web capture. They should be documented as permanently unresolved rather than chased.

### What I would *not* do

Revise the workflow? No — the tooling is sound and its redaction model is good. The workflow is under-specified rather than wrong.

Investigate further first? Only if B-1 comes back negative or ambiguous. Otherwise the two read-only captures are cheap, safe, and immediately productive.

---

## 7. Invocation Reference (for later use — NOT RUN)

### 7.1 Locate a browser executable (resolves B-3)

```bash
ls -d /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome 2>/dev/null
ls -d /Applications/Chromium.app/Contents/MacOS/Chromium 2>/dev/null
ls -d "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" 2>/dev/null
```

### 7.2 Capture 1 — PostgREST schema introspection (U-02, U-04, U-06, U-07)

```bash
SUPABASE_URL="https://fmfyvplvutcusvxvymxj.supabase.co"
ANON_KEY="<read from bundle; do NOT commit>"

# Read-only. Writes response to a path OUTSIDE the repository.
curl -sS "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Accept: application/openapi+json" \
  -o "$CAPTURE_DIR/rest-openapi.json"

shasum -a 256 "$CAPTURE_DIR/rest-openapi.json"
```

Then classify: enumerate `definitions` / `components.schemas` for tables, columns, and enums; compare against the 10 tables observed in Phase A.

### 7.3 Capture 2 — Unauthenticated landing observation (U-08, U-09)

```python
# Run via REA tools.rea.capture_browser_scenario — NOT executed in this task.
{
  "browser": { "mode": "launch", "executable_path": "<B-3 result>", "headless": True },
  "start_url": { "url": "https://www.handyquoter.com/landing" },
  "actions": [
    { "step_id": "load",   "action": "goto",
      "destination": { "url": "https://www.handyquoter.com/landing" },
      "wait_until": "networkidle", "timeout_ms": 30000 },
    { "step_id": "settle", "action": "wait_for_timeout", "duration_ms": 5000 }
  ],
  "capture": {
    "after_each_step": ["url"],
    "at_end": ["url", "history"],
    "events": ["network", "websockets"],
    "network": { "request_body": true, "response_body": true, "header_values": false }
  }
}
```

Note `header_values: false` deliberately — bodies are needed for Realtime payloads, header values are not, and this keeps tokens out of the artifact.

### 7.4 Post-capture obligations

1. Write all captures **outside** the repository working tree.
2. Compute and record SHA-256 for each.
3. Update blueprint U-items with new tags + provenance (`RUNTIME_OBSERVED`, distinct from `JS_BUNDLE` and `JS_BUNDLE_STRING_SCAN`).
4. Redact before any commit.
5. `export_evidence_bundle` before the REA session closes.
6. Address **D-3** (record the evidence bundle digest) and **D-4** (sourcemap coverage fields) while in the blueprint.

---

## Appendix — Audit Provenance

| Check | Method |
|---|---|
| Git state | `git status -sb`, `git rev-parse`, `git ls-files` |
| File inventory | `find` excluding `.git` |
| Bundle verification | `os.path.getsize`, `json.load`, SHA-256, substring search for both evidence IDs |
| Filename consistency | `grep -rno` across `*.json` and `*.md` |
| Sourcemap re-verification | `grep -c` whole-file, 120-byte tail dump, HTTP HEAD on `.map` |
| Workflow 3 tooling | `search` of REA and browser namespaces; full `capture_browser_scenario` contract read |

No live-target request was issued during this audit beyond read-only `HEAD`/`GET` checks against public static assets (bundle, `.map` URLs) needed to verify Phase A claims. No state-changing action was taken. No existing evidence was modified.