# Network Safety — R1

**Scope:** how this project prevents reconstruction code and its tests from
reaching the original HandyQuoter service, and — equally important — what that
protection does **not** cover.

The operator holds **no authorization** for the original service. See
`.opencode/reconstruction-spec.md` §0.

---

## 1. What the guard does

`npm test` installs `src/safety/network-deny.ts` automatically via
`node --import ./test/setup.ts`. The guard is therefore active **before any test
or application module is evaluated**, and a test cannot run unguarded by
forgetting an explicit `installNetworkDeny()` call.

While installed, the guard **blocks requests to matching production targets
over the guarded `fetch` and `WebSocket` transports**. Refusal happens
synchronously, before a socket is opened.

Denied host suffixes:

```
supabase.co   stripe.com   recaptcha.net   google.com   apple.com
reddit.com    redditit.com
```

`supabase.co` is covered wholesale, not just the observed project
`fmfyvplvutcusvxvymxj.supabase.co`, because no authorization exists for any part
of the service.

Matching is URL-based, so these do not evade it:

- port variants — `https://host:8443/…`
- userinfo tricks — `https://legit.com@host/…`
- case variants — `https://HOST/…`
- non-default schemes — `wss://host/realtime/v1/websocket`

Local development (`localhost`, `127.0.0.0/8`, `::1`) is explicitly allowed.

---

## 2. What the guard does NOT do

**This is a JavaScript-level guard rail. It is not a sandbox and not a
network-isolation boundary.** It monkey-patches in-process globals, and anything
reaching an unwrapped transport bypasses it entirely.

| Transport | Status | Why |
|---|---|---|
| `globalThis.fetch` | **Guarded** | global replaced with a validating wrapper |
| `globalThis.WebSocket` | **Guarded** | global replaced with a Proxy construct trap; native prototype chain preserved |
| `node:http` / `node:https` | **Not guarded** | built-in modules bound at import time; reachable via `import https from "node:https"` |
| `node:dgram` (UDP) | **Not guarded** | built-in module |
| `XMLHttpRequest` (browser) | **Not guarded** | absent in Node; unguarded in a browser context |
| `EventSource` (browser) | **Not guarded** | absent in Node; unguarded in a browser context |
| `node:child_process` | **Not guarded** | a spawned process is outside this process entirely |
| DNS / TLS / kernel | **Not guarded** | below the language runtime |

The authoritative, test-asserted version of this table is exported as
`TRANSPORT_COVERAGE` in `src/safety/network-deny.ts`. Tests fail if it drifts.

---

## 3. Do not conclude that production access is impossible

**Passing JavaScript tests does not prove production access is impossible.**

The guard is:

- **opt-in** — active only after installation
- **removable** — `uninstall()` restores the originals by design
- **per-process** — it does not follow child processes, workers, or other runtimes

Additional reasons it is not a boundary:

1. `node:http`/`node:https` cannot be wrapped from JavaScript.
2. A child process running `curl` is entirely outside the guard.
3. Nothing constrains DNS resolution or the kernel's TCP stack.

---

## 4. Environment isolation — evaluated and unavailable

Checked on this host (macOS, Node v24.21.0, arm64):

| Option | Result |
|---|---|
| Node `--permission` model | **No network scope.** Flags are `--allow-fs-read`, `--allow-fs-write`, `--permission`, `--permission-audit`. Verified: an external `fetch` **succeeds** under `--permission`. |
| Container runtime (`docker`, `podman`, `colima`) | **Absent.** |
| `pfctl` (macOS firewall) | Present, but **requires root** and is system-wide. |
| `sandbox-exec` | Present, but **requires root** and is system-wide. |

**There is no reliable no-egress sandbox in this environment, and none is
claimed.** Tests run with stubbed transports; no test makes a network request.

---

## 5. Browser integration tests — mandatory prerequisite

If browser-based integration tests are added later, the harness **must install
and verify BOTH HTTP and WebSocket interception before any test runs.**

Rationale: in a browser, `XMLHttpRequest` and `EventSource` are separate APIs
that the current guard does not wrap, and Supabase Realtime uses WebSocket. A
browser harness that intercepts only `fetch` would silently permit exactly the
traffic this project exists to prevent.

Before running any browser test, assert that:

1. HTTP requests to denied hosts are refused
2. WebSocket connections to denied `wss://` hosts are refused
3. Both refusals occur before the request leaves the browser

---

## 6. Configuration safety

`src/safety/local-endpoint.ts` provides fail-closed validation for the local
Supabase client:

- the URL must be supplied **explicitly** — nothing is defaulted
- the observed production host is rejected with a dedicated `production` code
- only loopback hosts are accepted unless explicitly opted in; opt-in **cannot**
  override the production rejection
- missing, empty, non-string, malformed, or `ws:`/`ftp:` values all **throw**
- there is **no fallback** and no discovery of the original application's URL —
  the known production host is a constant used only to **reject** it

---

## 7. Reporting discipline

When summarising test results, state:

- which transports the guard intercepts
- which transports remain outside its protection
- that the mechanism is a guard rail, not isolation

Never state or imply that the passing suite makes production access impossible.