/**
 * Network deny guard — defence in depth.
 *
 * ⚠️ READ THIS BEFORE RELYING ON IT
 *
 * This module is a **JavaScript-level guard rail, not a sandbox and not a
 * network-isolation boundary.** It monkey-patches in-process globals and can be
 * bypassed by any code that reaches a transport it does not wrap, by code that
 * restores the original global, or by a child process. See
 * `TRANSPORT_COVERAGE` below for the authoritative, machine-readable list of
 * what is and is not intercepted, and `docs` notes in the reconstruction spec
 * for the environment-level options that were evaluated and rejected.
 *
 * The operator holds NO authorization for the original HandyQuoter service.
 * Reconstruction code must never reach it, nor the payment, CAPTCHA,
 * store-verification or publishing services observed in the bundle.
 *
 * This guard performs no network I/O of its own and is verified in tests with
 * stubbed transports.
 */

/** The exact Supabase project observed in the bundle. */
export const PRODUCTION_SUPABASE_HOST = "fmfyvplvutcusvxvymxj.supabase.co";

/**
 * Host suffixes that reconstruction code must never contact.
 *
 * Supabase is covered wholesale rather than only by the observed project ref,
 * because no authorization exists for any part of the service.
 */
export const DENIED_HOST_SUFFIXES: readonly string[] = [
  "supabase.co",
  "stripe.com",
  "recaptcha.net",
  "google.com",
  "apple.com",
  "reddit.com",
  "redditit.com",
];

/** Hostnames denied outright, regardless of suffix matching. */
export const DENIED_HOSTS: readonly string[] = [PRODUCTION_SUPABASE_HOST];

/**
 * Schemes the guard understands. `ws`/`wss` are included because the observed
 * application uses Supabase Realtime over WebSocket.
 */
export const DENIED_SCHEMES: readonly string[] = ["http:", "https:", "ws:", "wss:"];

/* -------------------------------------------------------------------------- */
/* Transport coverage — authoritative, and deliberately incomplete             */
/* -------------------------------------------------------------------------- */

export interface TransportCoverage {
  /** Transport identifier. */
  readonly transport: string;
  /** True only if `installNetworkDeny()` actually intercepts it. */
  readonly guarded: boolean;
  /** How interception works. */
  readonly mechanism: string;
  /** Honest description of what remains possible. */
  readonly limitation: string;
}

/**
 * The authoritative coverage matrix. Asserted by tests so it cannot silently
 * drift into an over-claim.
 *
 * A JS guard cannot wrap `node:http`/`node:https` (CommonJS/ESM built-in
 * modules, bound at import time) or `node:child_process`. Those remain open and
 * are reachable from any code in the process.
 */
export const TRANSPORT_COVERAGE: readonly TransportCoverage[] = [
  {
    transport: "globalThis.fetch",
    guarded: true,
    mechanism: "global replaced with a validating wrapper",
    limitation:
      "Opt-in: only active after installNetworkDeny(). Removable via uninstall(). " +
      "Direct undici dispatch bypasses the global.",
  },
  {
    transport: "globalThis.WebSocket",
    guarded: true,
    mechanism: "global replaced with a Proxy construct trap",
    limitation:
      "Opt-in. Covers wss:// and ws://. Does not cover ws module, " +
      "node:_http_client upgrades, or worker-thread globals.",
  },
  {
    transport: "node:http / node:https",
    guarded: false,
    mechanism: "not interceptable from JS",
    limitation:
      "Built-in modules bound at import time. Reachable via require/import. " +
      "Must be excluded by review or by an environment-level control.",
  },
  {
    transport: "node:dgram (UDP)",
    guarded: false,
    mechanism: "not interceptable from JS",
    limitation: "Built-in module; not used by Supabase but not blocked.",
  },
  {
    transport: "XMLHttpRequest (browser)",
    guarded: false,
    mechanism: "not intercepted by this guard",
    limitation:
      "Absent in Node. If this guard is reused in a browser context, XHR and " +
      "EventSource would both bypass it. Any browser test harness MUST wrap " +
      "HTTP AND WebSocket interception before use.",
  },
  {
    transport: "EventSource (browser)",
    guarded: false,
    mechanism: "not intercepted by this guard",
    limitation: "Absent in Node. Unguarded in any browser context.",
  },
  {
    transport: "node:child_process",
    guarded: false,
    mechanism: "out of process scope",
    limitation:
      "A spawned process (curl, another runtime) is entirely outside this guard.",
  },
  {
    transport: "DNS / TLS / kernel",
    guarded: false,
    mechanism: "no environment-level isolation available",
    limitation:
      "Node's --permission model has no network scope (verified: external fetch " +
      "succeeds under --permission). No container runtime on this host. " +
      "pfctl/sandbox-exec require root and are system-wide. There is therefore " +
      "NO reliable no-egress sandbox in this environment.",
  },
];

/* -------------------------------------------------------------------------- */
/* Matching                                                                    */
/* -------------------------------------------------------------------------- */

export class ProductionTargetError extends Error {
  readonly url: string;
  readonly host: string;

  constructor(url: string, host: string) {
    super(
      `Blocked by network-deny: "${url}" resolves to denied host "${host}". ` +
        `This project holds no authorization for the original service. ` +
        `Use a local fixture or a locally controlled Supabase instance instead.`,
    );
    this.name = "ProductionTargetError";
    this.url = url;
    this.host = host;
  }
}

function hostnameOf(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  // `URL` lowercases the hostname and keeps userinfo out of it, so
  // `https://x@evil.supabase.co/` correctly yields `evil.supabase.co`.
  // Works identically for ws:/wss: input.
  return parsed.hostname.toLowerCase();
}

/**
 * True when a URL targets a denied host.
 *
 * Returns `false` for unparseable input rather than throwing, so callers can
 * log-and-decide. Matching is suffix-aware: a denied entry matches the host
 * itself and any subdomain of it.
 */
export function isDeniedTarget(rawUrl: string): boolean {
  const host = hostnameOf(rawUrl);
  if (host === null) return false;

  if (DENIED_HOSTS.includes(host)) return true;

  return DENIED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Throws {@link ProductionTargetError} when the URL targets a denied host. */
export function assertNotDeniedTarget(rawUrl: string): void {
  const host = hostnameOf(rawUrl);
  if (host !== null && isDeniedTarget(rawUrl)) {
    throw new ProductionTargetError(rawUrl, host);
  }
}

/* -------------------------------------------------------------------------- */
/* Enforcement                                                                 */
/* -------------------------------------------------------------------------- */

export interface NetworkDenyHandle {
  /** Restore the original `globalThis.fetch` and `globalThis.WebSocket`. */
  uninstall(): void;
  /** Which transports this install actually intercepted. */
  readonly coverage: readonly TransportCoverage[];
}

type FetchLike = typeof fetch;
type WebSocketLike = typeof WebSocket;

/** Extract a comparable URL string from anything fetch/WS accepts. */
function urlOf(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof input === "object" && "url" in input) {
    const url = (input as { url: unknown }).url;
    if (typeof url === "string") return url;
  }
  return null;
}

/**
 * Install the guard over `globalThis.fetch` and `globalThis.WebSocket`.
 *
 * Both checks run before any socket is opened. WebSocket interception uses a
 * Proxy construct trap so the native class, prototype chain and `instanceof`
 * behaviour are preserved.
 *
 * Returns a handle that restores the previous implementations. Transports that
 * this runtime cannot intercept are reported in `coverage` as `guarded: false`
 * rather than being silently omitted.
 */
export function installNetworkDeny(): NetworkDenyHandle {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;

  const guardedFetch: FetchLike = (input, init) => {
    const raw = urlOf(input);
    if (raw !== null) assertNotDeniedTarget(raw);
    return originalFetch(input, init);
  };

  let guardedWebSocket: WebSocketLike | undefined;
  let webSocketIntercepted = false;

  if (typeof originalWebSocket === "function") {
    const proxy = new Proxy(originalWebSocket, {
      construct(target: WebSocketLike, args: unknown[]) {
        const raw = urlOf(args[0]);
        if (raw !== null) assertNotDeniedTarget(raw);
        return Reflect.construct(target, args as never);
      },
    }) as WebSocketLike;
    globalThis.WebSocket = proxy;
    guardedWebSocket = proxy;
    webSocketIntercepted = true;
  }

  globalThis.fetch = guardedFetch;

  const coverage = TRANSPORT_COVERAGE.map((entry) =>
    entry.transport === "globalThis.WebSocket"
      ? { ...entry, guarded: webSocketIntercepted }
      : entry,
  );

  return {
    uninstall() {
      globalThis.fetch = originalFetch;
      if (guardedWebSocket !== undefined) {
        globalThis.WebSocket = originalWebSocket;
      }
    },
    coverage,
  };
}