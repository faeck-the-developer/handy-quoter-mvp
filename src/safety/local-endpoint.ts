/**
 * Local Supabase endpoint resolution — fail-closed.
 *
 * The reconstruction must talk to a locally controlled Supabase instance. This
 * module makes that the only path:
 *
 *   - configuration must be supplied EXPLICITLY; nothing is defaulted
 *   - the observed production host is rejected with a dedicated error
 *   - only loopback hosts are accepted unless extra hosts are opted in
 *   - missing, empty, non-string, malformed, or production values all THROW
 *   - there is deliberately NO fallback path and no discovery of the original
 *     application's URL — the known production host is a constant used only to
 *     REJECT it, never to supply a default
 *
 * This is configuration validation, not a network control. It prevents the
 * worst failure mode (tests silently reaching production) at the point where a
 * URL would otherwise be read from somewhere; it does not itself block traffic.
 * Pair it with `network-deny.ts`.
 */

import { PRODUCTION_SUPABASE_HOST } from "./network-deny.ts";

/** Hostnames that identify a local development machine. */
export const LOOPBACK_HOSTNAMES: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

export type LocalEndpointErrorCode =
  | "missing"
  | "malformed"
  | "production"
  | "not-local"
  | "missing-key";

export class LocalEndpointError extends Error {
  readonly code: LocalEndpointErrorCode;
  readonly received: unknown;

  constructor(code: LocalEndpointErrorCode, message: string, received?: unknown) {
    super(message);
    this.name = "LocalEndpointError";
    this.code = code;
    this.received = received;
  }
}

/** Explicit, fully-specified configuration. Nothing here has a default. */
export interface LocalSupabaseConfig {
  /** e.g. "http://127.0.0.1:54321". Required. */
  readonly url?: unknown;
  /** The LOCAL instance's anon key. Required. */
  readonly anonKey?: unknown;
  /**
   * Extra hosts permitted beyond loopback, for a shared dev machine.
   * Defaults to empty — opt-in only.
   */
  readonly additionalAllowedHosts?: readonly string[];
}

export interface ResolvedLocalSupabase {
  readonly url: URL;
  readonly anonKey: string;
  readonly isLocalhost: boolean;
}

/** True when a hostname identifies the local machine. Exported for reuse and tests. */
export function isLoopbackHost(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  if (LOOPBACK_HOSTNAMES.includes(lowered)) return true;
  // Bare "::1" without brackets, and the 127.0.0.0/8 block.
  if (lowered === "::1") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lowered)) return true;
  return false;
}

/**
 * Validate a raw URL string and return the parsed URL.
 *
 * Throws {@link LocalEndpointError} rather than returning a fallback. The order
 * of checks matters: a malformed value is reported as malformed, and only a
 * well-formed URL that names the production host is reported as production.
 */
export function assertLocalEndpointUrl(raw: unknown, additionalAllowedHosts: readonly string[] = []): URL {
  if (raw === undefined || raw === null) {
    throw new LocalEndpointError(
      "missing",
      "No local Supabase URL configured. Pass `url` explicitly — this project " +
        "never falls back to a default or to a URL from the original application.",
    );
  }
  if (typeof raw !== "string") {
    throw new LocalEndpointError("malformed", `Local Supabase URL must be a string, received ${typeof raw}.`, raw);
  }
  if (raw.trim() === "") {
    throw new LocalEndpointError("missing", "Local Supabase URL is empty.", raw);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new LocalEndpointError("malformed", `Local Supabase URL is not a valid URL: "${raw}".`, raw);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LocalEndpointError(
      "malformed",
      `Local Supabase URL must use http: or https:, received "${parsed.protocol}".`,
      raw,
    );
  }

  const host = parsed.hostname.toLowerCase();

  if (host === PRODUCTION_SUPABASE_HOST || host.endsWith(`.${PRODUCTION_SUPABASE_HOST}`)) {
    throw new LocalEndpointError(
      "production",
      `Refusing to use the original production Supabase host "${host}". ` +
        `This project holds no authorization for that service. Configure a ` +
        `locally controlled instance instead.`,
      raw,
    );
  }

  const extra = additionalAllowedHosts.map((h) => h.toLowerCase());
  const allowed = isLoopbackHost(host) || extra.includes(host);

  if (!allowed) {
    throw new LocalEndpointError(
      "not-local",
      `Local Supabase URL host "${host}" is not loopback. Only ${LOOPBACK_HOSTNAMES.join(", ")} ` +
        `(or hosts you explicitly opt into via additionalAllowedHosts) are accepted.`,
      raw,
    );
  }

  return parsed;
}

/**
 * Resolve a complete, validated local Supabase configuration.
 *
 * Fails closed on every missing or invalid input. There is no default and no
 * fallback — a caller that forgets configuration gets an exception, never a
 * working client pointed somewhere unexpected.
 */
export function resolveLocalSupabase(config: LocalSupabaseConfig): ResolvedLocalSupabase {
  const extra = config.additionalAllowedHosts ?? [];
  const url = assertLocalEndpointUrl(config.url, extra);

  if (config.anonKey === undefined || config.anonKey === null) {
    throw new LocalEndpointError(
      "missing-key",
      "No local Supabase anon key configured. Pass `anonKey` explicitly; " +
        "there is no default key.",
    );
  }
  if (typeof config.anonKey !== "string" || config.anonKey.trim() === "") {
    throw new LocalEndpointError(
      "malformed",
      `Local Supabase anon key must be a non-empty string, received ${
        typeof config.anonKey === "string" ? "an empty string" : typeof config.anonKey
      }.`,
      config.anonKey,
    );
  }

  return {
    url,
    anonKey: config.anonKey,
    isLocalhost: isLoopbackHost(url.hostname.toLowerCase()),
  };
}