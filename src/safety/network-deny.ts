/**
 * Network deny guard.
 *
 * The operator holds NO authorization for the original HandyQuoter service
 * (see `.opencode/reconstruction-spec.md` §0). Reconstruction code and its tests
 * must never reach the production backend, and must never contact the payment,
 * CAPTCHA, store-verification or publishing services observed in the bundle.
 *
 * This guard is a *local* control. It performs no network I/O of its own and is
 * verified in tests without issuing any request.
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

export interface NetworkDenyHandle {
  /** Restore the original `globalThis.fetch`. */
  uninstall(): void;
}

/**
 * Install the guard over `globalThis.fetch`.
 *
 * The check runs before any socket is opened, so a denied call never leaves the
 * process. Returns a handle that restores the previous implementation.
 */
export function installNetworkDeny(): NetworkDenyHandle {
  const original = globalThis.fetch;
  const guarded: typeof fetch = (input, init) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    assertNotDeniedTarget(raw);
    return original(input, init);
  };

  globalThis.fetch = guarded;
  return {
    uninstall() {
      globalThis.fetch = original;
    },
  };
}