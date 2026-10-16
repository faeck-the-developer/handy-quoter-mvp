/**
 * Local Supabase client factory — fail-closed.
 *
 * ⚠️ This project holds NO authorization for the original HandyQuoter service.
 * The factory refuses to build a client for any endpoint other than an
 * explicitly configured LOCAL instance. It never defaults, never discovers, and
 * never falls back to the URL observed in the original application.
 *
 * The production host is imported ONLY as a value to REJECT.
 *
 * Configuration validation lives in `src/safety/local-endpoint.ts`. This module
 * adds client construction on top of it and re-asserts the resolved endpoint
 * before handing it to the Supabase SDK, so a future refactor cannot quietly
 * widen the accepted set.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  LocalEndpointError,
  resolveLocalSupabase,
  type LocalSupabaseConfig,
  type ResolvedLocalSupabase,
} from "../safety/local-endpoint.ts";
import { isDeniedTarget, PRODUCTION_SUPABASE_HOST } from "../safety/network-deny.ts";

export { LocalEndpointError };
export type { LocalSupabaseConfig, ResolvedLocalSupabase };

/** Untyped row mode: these contracts are observed, not authoritative schemas. */
export type UntypedSchema = Record<string, unknown>;

export interface LocalSupabaseClient {
  readonly client: SupabaseClient<UntypedSchema>;
  /** The validated local endpoint actually used. */
  readonly endpoint: URL;
  readonly isLocalhost: boolean;
}

export interface CreateLocalClientOptions extends LocalSupabaseConfig {
  /** Forwarded to createClient. Defaults are conservative. */
  readonly auth?: {
    readonly persistSession?: boolean;
    readonly autoRefreshToken?: boolean;
    readonly detectSessionInUrl?: boolean;
  };
}

/**
 * Build a Supabase client pointed at an explicitly configured LOCAL instance.
 *
 * Throws {@link LocalEndpointError} when configuration is missing, malformed,
 * non-loopback (without opt-in), or names the original production host. There
 * is no default endpoint and no fallback path of any kind.
 *
 * This function performs no network I/O at construction time.
 */
export function createLocalSupabaseClient(options: CreateLocalClientOptions): LocalSupabaseClient {
  // Fail closed with a typed error rather than a raw TypeError when the caller
  // passes nothing at all.
  if (options === null || typeof options !== "object") {
    throw new LocalEndpointError(
      "missing",
      "createLocalSupabaseClient requires an explicit configuration object. " +
        "There is no default endpoint and no fallback to the original application.",
      options,
    );
  }

  const resolved = resolveLocalSupabase(options);

  // Defence in depth: re-assert the guarantee immediately before construction.
  // resolveLocalSupabase already rejects the production host; this guards
  // against a future change to that module silently widening acceptance.
  const origin = resolved.url.origin;
  if (resolved.url.hostname.toLowerCase() === PRODUCTION_SUPABASE_HOST) {
    throw new LocalEndpointError(
      "production",
      `Refusing to construct a client for the production host "${resolved.url.hostname}".`,
      origin,
    );
  }
  if (isDeniedTarget(origin)) {
    throw new LocalEndpointError(
      "not-local",
      `Refusing to construct a client for denied host "${resolved.url.hostname}".`,
      origin,
    );
  }

  const client = createClient<UntypedSchema>(origin, resolved.anonKey, {
    auth: {
      persistSession: options.auth?.persistSession ?? false,
      autoRefreshToken: options.auth?.autoRefreshToken ?? false,
      detectSessionInUrl: options.auth?.detectSessionInUrl ?? false,
    },
  });

  return {
    client,
    endpoint: resolved.url,
    isLocalhost: resolved.isLocalhost,
  };
}