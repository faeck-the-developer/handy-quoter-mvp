# Reconstruction Specification — HandyQuoter (Clean-Room)

**Date:** 2026-10-15
**Authorization status:** ⚠️ **The operator does not own this product and has no
authorization.** No live backend investigation is permitted. Everything below is
derived from static analysis of publicly served frontend artifacts and ordinary
non-invasive browsing of public pages.

**Provenance tiers:**
`JS_BUNDLE` (REA Evidence) · `JS_BUNDLE_STRING_SCAN` (shell over artifact bytes) ·
`CSS_SCAN` (public static stylesheet) · `INFERRED` · `UNKNOWN`

---

## 0. Evidence base

| Artifact | Bytes | sha256 (16) |
|---|---|---|
| `index-BvjQI7i8.js` | 1,911,788 | `2e3bf0bc172644d7` |
| `web-CTVV3Kh5.js` | 14,782 | `379c030fd2c43bc0` |
| `index-Dg9DvioW.js` | 1,351 | `9161df22ee2c4bc3` |
| `index-D0tPlqll.css` | 104,747 | `dccf839e7a0f78f8` |
| 5 Capacitor shims | 295–781 | — |

**Coverage:** the main bundle is 99.94% of served code. The five additional
chunks are platform-variant shims, not route code. Analysis coverage is
effectively complete.

Placeholder convention used below:
`⟨MOCK:…⟩` = needs a local mock/fixture · `⟨UNKNOWN:…⟩` = evidence insufficient ·
`⟨UNVERIFIABLE⟩` = cannot be legitimately observed without authorization.

---

## 1. Platform and stack — `JS_BUNDLE` + `CSS_SCAN`

| Layer | Observed |
|---|---|
| Bundler | Vite (`__vite__mapDeps`, `import()` code-splitting) |
| Framework | React 18 (`reactjs.org` reference, `jsx()` calls) |
| Routing | SPA router, 40 path literals, `*` catch-all |
| Backend | Supabase — REST, Auth (GoTrue), Realtime, Edge Functions, Storage |
| Styling | Tailwind CSS + shadcn/ui token set (`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, `--radius`) |
| Mobile | Capacitor — `Share`, `Toast`, `SplashScreen`, `WebSocket`, `Billing` plugins |
| Payments | Stripe — Connect, Checkout, Payment Links, Billing Portal |
| AI | Edge-function-backed (quote generation, transcription, content) |
| Analytics | GTM `G-4MG4HH9H7G`, GA, `landing_page_visitors` table |

**`--background`…`--radius` and 608 `:root` custom properties indicate the
shadcn/ui default theme — a standard open-source component library, not
product-specific expression.** Component markup derived from it carries no
proprietary design.

---

## 2. Page inventory — 40 routes

Classification column is **`INFERRED`** from route semantics plus observed nav
labels. It is **not** `SEEN`: no client-side route guard exists (§3).

### 2.1 Marketing / public — `INFERRED`

`/` · `/landing` · `/about` · `/blog` · `/blog/:slug` · `/comparison` ·
`/trades` · `/industry-fit` · `/hvac-contractors` · `/kitchen-contractors` ·
`/bathroom-contractors` · `/legal` · `/privacy` · `/how-to` · `/support` ·
`/content-hub` · `/roi-calculator`

### 2.2 Authentication — `INFERRED`

`/login` · `/signup` · `/reset-password` · `/auth` · `/delete-account`

### 2.3 Product surfaces — `INFERRED`

`/dashboard` · `/customers` · `/analytics` · `/revenue` · `/reports`

Nav labels observed: `Dashboard`, `Customers`, `Revenue`, `Reports`,
`New Customer`, `Schedule Job`, `Call Customer`, `Billing & Subscription`.

### 2.4 Conversion flows — `INFERRED`

`/demo` · `/try-demo` · `/phone-demo` · `/voice-quote` · `/intake/:userId`

### 2.5 Payment — `INFERRED`

`/pay/:invoiceId` · `/pay/success` · `/pay/cancel` · `/payment-success`

### 2.6 Special / utility — `INFERRED`

`/splash` · `/embed/:widgetType` · `/gamesummary` · `/index.html` · `*`

**Total: 40.** The route table is `SEEN` (REA endpoint nodes and static literals
agree exactly). **The classification above is `INFERRED`.**

---

## 3. Route protection — a significant negative finding

| Pattern | Occurrences |
|---|---|
| `requiresAuth` | **0** |
| `ProtectedRoute` / route-guard wrapper | **0** |
| `redirect("/login")` | **0** |
| `getSession()` | 11 |

**No client-side route guard was found.** The SPA appears to render routes
regardless of session state and rely on:

1. **Supabase RLS** to deny unauthorized data at the database, and
2. **conditional rendering** to hide unavailable UI.

**Consequence:** which routes are genuinely protected is `UNKNOWN` and depends
entirely on **U-03 (RLS)**, which cannot be observed without authorization.
Do **not** implement route guards as though their existence were established —
implement them as a *reconstruction decision* and label them as such.

---

## 4. Responsive layout — `CSS_SCAN`

Tailwind breakpoint ladder, min-width only (mobile-first):

| Breakpoint | px | Tailwind |
|---|---|---|
| sm | 640 | `sm:` |
| md | 768 | `md:` |
| lg | 1024 | `lg:` |
| xl | 1280 | `xl:` |
| 2xl | 1400 | *(custom)* |

`max-width` values 200 / 280 / 320 / 420 / 425 / 500 / 600 are container
constraints, not breakpoints. **1400px is a non-default addition** — the widest
content is capped there.

Also: 8 `@keyframes`, 608 `:root` custom properties, 5 `@media` blocks total.
The whole stylesheet is 104 KB — layout is utility-class driven, so exact
component layout must be read from class composition per route, not from
standalone CSS rules.

**Default viewport for capture tooling:** 1280×720 (per REA's default
environment). Note 1280 is exactly the `xl` boundary — a useful default for
desktop reproduction.

---

## 5. Component inventory

### 5.1 Evidence-bounded

| Component | Source | Confidence |
|---|---|---|
| App shell + all 40 routes | `index-BvjQI7i8.js` | `SEEN` (present) |
| `VoiceRecorderWeb` class | `web-CTVV3Kh5.js` | `SEEN` — `export { VoiceRecorderWeb }` |
| `Directory`, `Encoding`, `Filesystem` | `index-Dg9DvioW.js` | `SEEN` — named exports |
| Share / Toast / SplashScreen plugins | 3 shims | `SEEN` — Capacitor wrappers |
| Billing plugin | `web-DVSI8jOs.js` | `SEEN` — **web-mocked** |

### 5.2 shadcn/ui primitives — `INFERRED`

Implied by the token set and 46 distinct ARIA attributes:
button · input · label · card · table · dialog · tabs · select · toast ·
tooltip · dropdown-menu · separator · badge · checkbox · radio-group ·
collapsible · popover · progress · skeleton · alert

**Not `SEEN`** — these are library components, not product-specific code, and
should be rebuilt from the open-source library, not reverse-engineered.

### 5.3 Accessibility posture — `CSS_SCAN` + `JS_BUNDLE_STRING_SCAN`

46 distinct ARIA attributes. Heavy usage: `aria-hidden` (25), `aria-label` (23),
`aria-selected` (17), `aria-labelledby` (12), `aria-describedby` (9),
`aria-expanded` (8), `aria-live` (6), `aria-required` (5), `aria-invalid` (2).
This is a mature accessibility baseline and should be reproduced.

---

## 6. Interaction specification

### 6.1 Input surface — `JS_BUNDLE_STRING_SCAN`

| Input type | Count | Observed placeholders |
|---|---|---|
| `number` | 19 | `Qty`, `$0.00`, `0.00`, `175` (hours) |
| `email` | 15 | `john@example.com`, `customer@example.com`, `Enter your email` |
| `text` | 12 | `John`, `Doe`, `Doe Construction`, `Material name` |
| `tel` | 7 | `(555) 123-4567` |
| `password` | 6 | `Create a strong password`, `Enter your password` |
| `date` | 2 | — |

62 distinct placeholder literals. Reproduction should use these exact strings —
they are the closest thing to a UI contract the static evidence provides.

### 6.2 Quote construction flow — `SEEN` (see B2 addendum §5)

```
laborTotal = hours × hourlyRate
subtotal   = round2(materialsTotal + laborTotal)
tax        = round2(subtotal × 0.08)          // 8% confirmed
totalCost  = round2(subtotal + tax)
amountDue  = amount_due ?? totalCost ?? 0
```

Materials row fields: `item`, `quantity`, unit price (`f=()=>({item:"",quantity:"1",un…`).
Labour object: `{hours, hourlyRate, totalCost}`.

All input coercion is defensive — every numeric field is guarded:

```js
typeof x === "string" ? parseFloat(x) || 0 : x || 0
```

**Reproduce this coercion exactly.** It is observable behaviour and affects
edge-case results.

### 6.3 Domain vocabularies — `JS_BUNDLE_STRING_SCAN` (`SEEN` as lists)

**Trades:** Plumbing · Electrical · HVAC · Handyman Services · Landscaping ·
Cleaning Services · Construction · Painting · Roofing · Flooring · Other

**Support categories:** Technical Support · Feature Request · Bug Report ·
Account Issues · General Question

**Outreach types:** Blog Post · Social Media Posts · Email Sequence ·
LinkedIn · Twitter/X · Facebook · Instagram · Reddit · Guest Posting Sites ·
Resource Pages & Directories · Broken Link Opportunities · Competitor Analysis ·
Guest Post Pitch · Resource Listing Request · Broken Link Outreach ·
Partnership/Collaboration

**Quote payment types:** `deposit` (confirmed via
`payment_type === "deposit" ? deposit_percentage : undefined`) ·
`⟨UNKNOWN: full set⟩`

**Job / payment statuses:** pending · unpaid · partial · paid · overdue ·
completed — **`UNKNOWN` whether complete** (broadened sweep found no more; a
negative sweep is not proof of absence).

### 6.4 Voice quote — `SEEN` (`web-CTVV3Kh5.js`)

States: `Not Connected` · `Connected` · `Setup Incomplete`.
Pipeline: record → `transcribe-audio` edge function → `generate-quote` with
`{transcription, customerName, jobTitle, location}`.

### 6.5 Workflows that cannot be legitimately verified

| Interaction | Why | Placeholder |
|---|---|---|
| Any quote submission | Writes to `quote_history` in production | `⟨MOCK⟩` |
| Signup / login | Auth experiment, explicitly forbidden | `⟨MOCK⟩` |
| Stripe checkout / payment | Real financial instrument | `⟨MOCK⟩` — never live |
| Reddit publishing | Irreversible public content | `⟨DO NOT IMPLEMENT⟩` |
| Contact form | Requires reCAPTCHA — access control | `⟨DO NOT IMPLEMENT⟩` |
| IAP purchase | Web build is mocked; native only | `⟨MOCK⟩` |
| Route authorization | RLS unknown (§3) | `⟨UNKNOWN⟩` |

---

## 7. Backend contract requiring mocks

**All of the following must be satisfied locally. No reconstruction test may
point at `fmfyvplvutcusvxvymxj.supabase.co`.**

### 7.1 Edge functions — 22 `SEEN` names, bodies `UNKNOWN`

| Function | Request body keys | Response keys observed |
|---|---|---|
| `check-subscription` | — | `hasAccess`, `subscribed` |
| `check-trial-status` | `headers.Authorization` | `hasHadTrial` |
| `check-webhook-health` | `variant` | — |
| `create-checkout` | `priceType` | — |
| `create-connect-account` | `return_url`, `refresh_url` | — |
| `create-payment-link` | `quote_id`, `amount`, `payment_type`, `deposit_percentage`, `due_date` | — |
| `customer-portal` | `headers.Authorization` | — |
| `verify-recaptcha` | `token`, `action` | `success`, `isHuman`, `score` |
| `verify-ios-purchase` | `receipt`, `productId`, `transactionId` | — |
| `send-quote-email` | `to`, `subject`, `message`, `quote`, `customerName`, `jobTitle`, `profileImageUrl` | — |
| `send-contact-email` | `name`, `email`, `subject`, `message`, `leadType`, `recaptchaScore` | — |
| `generate-quote` | `transcription`, `customerName`, `jobTitle`, `location` | — |
| `transcribe-audio` | `audio` | — |
| `generate-job-prep` | `jobId`, `jobTitle`, `jobDescription`, `specificHelp`, `tools`, `tutorials` | — |
| `get-business-profile` | `userId` | `customerData`, `name`, `email`, `phone`, `address`, `projectDescription` |
| `generate-lead-magnet` | `email`, `industry`, `leadMagnetType` | — |
| `generate-outreach-emails` | `outreachType`, `targetSite`, `industry`, `businessName`, `contentOffer`, `personalNote` | — |
| `find-backlink-opportunities` | `industry`, `location`, `strategy` | — |
| `generate-seo-content` | — | — |
| `post-to-reddit` | `subreddit`, `title`, `content`, `postType` | — |
| `process-reddit-posts` | — | — |

**`DO NOT MOCK` in any form that could be mistaken for a live call:** the Reddit
pair. Implement as explicit `throw new Error("not implemented — see spec §6.5")`.

### 7.2 Tables — 10, observed-literal columns only

`jobs` · `profiles` · `customers` · `quote_history` · `marketing_leads` ·
`leads` · `scheduled_reddit_posts` · `landing_page_visitors` · `ml_predictions` ·
`ml_quote_analytics`

**Column sets are observed literals, not schema.** Mark every generated type
`observed-literal-set`. Never emit a field as absent.

### 7.3 RPCs — 2

`get_unique_visitors_count` (4 call sites) · `get_daily_visitor_stats` (1)
Return shapes `UNKNOWN`.

### 7.4 Auth — 8 mechanisms `SEEN`

`signInWithPassword` · `signUp` · `signOut` · `getSession` · `getUser` ·
`onAuthStateChange` · `updateUser` · `resetPasswordForEmail` ·
`signInWithOAuth` (1 site, provider `UNKNOWN`)

### 7.5 Realtime — `SEEN` (declaration only)

Channel `customers-changes`, subscription type `postgres_changes`, 2 activation
sites. Frame payloads `UNKNOWN`.

### 7.6 Storage — `SEEN` (client-side)

localStorage: `intake_section_variant`, `demoCompleted`, `demoSession`,
`isLoggedIn`, `visitor_id`, `supabase.auth.token`,
`supabase.gotrue-js.locks.debug`, `sb-…-auth-token`
sessionStorage: `splash-shown`, `session_id`
IndexedDB: `Disc`

Bucket name `profile-images` referenced. **Backend existence `UNKNOWN`.**

---

## 8. Behaviors reproducible with confidence

| # | Behavior | Confidence |
|---|---|---|
| 1 | 40-route SPA with catch-all | **High** — two independent methods agree |
| 2 | Pricing arithmetic incl. 8% tax and 2dp rounding | **High** — literal expressions |
| 3 | Defensive numeric input coercion | **High** — literal expressions |
| 4 | Responsive ladder 640/768/1024/1280/1400 | **High** — CSS scan |
| 5 | shadcn/ui token theme | **High** — 608 CSS vars |
| 6 | Quote insert payload shape | **High** — 3 identical write sites |
| 7 | 5 table insert payload shapes | **High** — complete sweep |
| 8 | Domain vocabularies (11 trades, 16 outreach types, 5 support) | **High** — literal lists |
| 9 | Input inventory + 62 placeholder strings | **High** |
| 10 | Client storage keys and media | **High** — REA `storage` nodes |
| 11 | ARIA baseline | **High** |
| 12 | Query-key families (14 observed shapes) | **Medium** — sample, not inventory |
| 13 | QueryKey invalidation scoping (`["jobs"]` vs `["jobs",uid]`) | **Medium** — semantics `INFERRED` |
| 14 | Realtime subscription declaration | **Medium** — declared, not observed |
| 15 | Page classification | **Low** — `INFERRED` from semantics |

---

## 9. Remaining unknowns

| ID | Question | Why unresolved | Legitimate future source |
|---|---|---|---|
| U-01 | 22 edge function bodies | Server-side | Vendor source / owner authorization — **currently unavailable** |
| U-02 | Table DDL | Client shows literals only | Privileged schema access — **unavailable** |
| U-03 | RLS policies | Server-side config | DB access — **unavailable** |
| U-04 | Unreferenced tables | Leave no client trace | Schema dump — **unavailable** |
| U-05 | Stored `raw_quote` values | Runtime data only | Test account — **unavailable** |
| U-06 | Enum domains | Static sweep bounded | DDL / constraints — **unavailable** |
| U-07b | `profile-images` bucket exists | Client reference only | Project access — **unavailable** |
| U-08r | Realtime frames | Not observed | Runtime capture — **unavailable** |
| U-09p | OAuth provider | Ambiguous hostnames | Config inspection — **unavailable** |
| U-10c | Full query-key space | Static limit | Source maps (404) or unminified build — **unavailable** |

**Every remaining unknown now requires an authorized or legitimate source that
does not currently exist.** None can be closed by further local analysis. Under
the current authorization boundary, **this reconstruction is as complete as the
evidence permits**, and the correct terminal state for these items is
`UNKNOWN` — not a guess.

---

## 10. Prioritized implementation phases

**Phase R1 — Foundation (no backend required)**
Scaffold React + Vite + Tailwind + shadcn/ui from the observed token set.
Implement the 40-route map. Implement responsive ladder. *Fully evidence-backed.*

**Phase R2 — Pure-domain logic (no backend required)**
Pricing module: `laborTotal`, `subtotal`, `tax`, `totalCost`, `amountDue`, 2dp
rounding, string coercion. Pure functions, directly unit-testable against the
observed expressions. **Highest-value, lowest-risk work.**

**Phase R3 — Client data layer against local mocks**
TypeScript types for 10 tables marked `observed-literal-set`. Supabase client
pointed at a **local** stack. Query keys per the 14 observed shapes.

**Phase R4 — Feature UI**
Job/customer/quote/payment screens per §2.3–2.5. Inputs per §6.1. Vocabularies
per §6.3.

**Phase R5 — Mock edge-function layer**
Local handlers for the 22 names. Explicit `DO NOT MOCK` for the Reddit pair.

**Phase R6 — Documented gaps**
Render explicit `⟨UNKNOWN⟩` placeholders where evidence is insufficient, rather
than fabricating plausible backend behaviour.

---

## 11. Standing constraints

1. **No request may reach `fmfyvplvutcusvxvymxj.supabase.co`** from
   reconstruction or its tests. Enforce with a network-deny default in test
   config.
2. **No route guard may be presented as observed** — §3 shows none exist
   client-side.
3. **No column may be declared absent** — coverage is bounded.
4. **No enum may be declared complete.**
5. **No successful backend behaviour may be invented.** Where the real response
   is unknown, emit an explicit error or placeholder.
6. **The 92 MB evidence bundle stays out of git.**