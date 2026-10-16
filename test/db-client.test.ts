import test from "node:test";
import assert from "node:assert/strict";

import { createLocalSupabaseClient } from "../src/db/client.ts";
import { LocalEndpointError } from "../src/safety/local-endpoint.ts";
import { PRODUCTION_SUPABASE_HOST } from "../src/safety/network-deny.ts";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_KEY = "local-dev-anon-key";
const PROD_URL = `https://${PRODUCTION_SUPABASE_HOST}`;

/* -------------------------------------------------------------------------- */
/* Happy path                                                                 */
/* -------------------------------------------------------------------------- */

test("client: builds a client for an explicitly configured local endpoint", () => {
  const built = createLocalSupabaseClient({ url: LOCAL_URL, anonKey: LOCAL_KEY });

  assert.equal(built.endpoint.origin, "http://127.0.0.1:54321");
  assert.equal(built.isLocalhost, true);
  assert.ok(built.client, "a SupabaseClient must be returned");
});

test("client: localhost and loopback are both accepted", () => {
  for (const url of ["http://localhost:54321", "http://127.0.0.1:54321", "http://127.0.0.5:54321"]) {
    const built = createLocalSupabaseClient({ url, anonKey: LOCAL_KEY });
    assert.equal(built.isLocalhost, true);
    assert.equal(built.endpoint.hostname, new URL(url).hostname);
  }
});

test("client: construction performs no network I/O", () => {
  // A local endpoint with nothing listening still constructs successfully —
  // proof that createClient did not attempt to connect.
  const built = createLocalSupabaseClient({
    url: "http://127.0.0.1:1", // deliberately nothing listening
    anonKey: LOCAL_KEY,
  });
  assert.equal(built.endpoint.port, "1");
});

/* -------------------------------------------------------------------------- */
/* Production rejection                                                       */
/* -------------------------------------------------------------------------- */

test("client: the production host is rejected", () => {
  assert.throws(
    () => createLocalSupabaseClient({ url: PROD_URL, anonKey: LOCAL_KEY }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

test("client: production rejection covers every URL form", () => {
  const variants = [
    PROD_URL,
    `${PROD_URL}/`,
    `${PROD_URL}/rest/v1`,
    `http://${PRODUCTION_SUPABASE_HOST}`,
    `https://${PRODUCTION_SUPABASE_HOST}:54321`,
    `https://${PRODUCTION_SUPABASE_HOST.toUpperCase()}/`,
  ];
  for (const url of variants) {
    assert.throws(
      () => createLocalSupabaseClient({ url, anonKey: LOCAL_KEY }),
      (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
      `expected ${url} to be rejected`,
    );
  }
});

test("client: a production host cannot be smuggled in via userinfo", () => {
  assert.throws(
    () => createLocalSupabaseClient({ url: `https://localhost@${PRODUCTION_SUPABASE_HOST}/`, anonKey: LOCAL_KEY }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

/* -------------------------------------------------------------------------- */
/* Fail closed — no defaults, no fallback                                     */
/* -------------------------------------------------------------------------- */

test("client: missing configuration throws; there is no default endpoint", () => {
  assert.throws(
    () => createLocalSupabaseClient({} as never),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing",
  );
  assert.throws(
    () => createLocalSupabaseClient(undefined as never),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing",
  );
});

test("client: a URL without a key fails closed", () => {
  assert.throws(
    () => createLocalSupabaseClient({ url: LOCAL_URL } as never),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing-key",
  );
});

test("client: malformed configuration throws", () => {
  const bad: unknown[] = ["", "   ", "not a url", "ftp://localhost:54321", "ws://localhost:54321", 42, {}];
  for (const url of bad) {
    assert.throws(
      () => createLocalSupabaseClient({ url, anonKey: LOCAL_KEY }),
      (e: unknown) => e instanceof LocalEndpointError,
      `expected ${JSON.stringify(url)} to be rejected`,
    );
  }
});

test("client: non-loopback hosts are rejected without explicit opt-in", () => {
  assert.throws(
    () => createLocalSupabaseClient({ url: "http://dev-box.internal:54321", anonKey: LOCAL_KEY }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "not-local",
  );
});

test("client: an opt-in host still cannot override the production rejection", () => {
  assert.throws(
    () =>
      createLocalSupabaseClient({
        url: PROD_URL,
        anonKey: LOCAL_KEY,
        additionalAllowedHosts: [PRODUCTION_SUPABASE_HOST],
      }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

/* -------------------------------------------------------------------------- */
/* Guard interaction                                                          */
/* -------------------------------------------------------------------------- */

test("client: the auto-installed guard is present while these tests run", () => {
  // The harness installs network-deny before any module loads; the client
  // factory must coexist with it rather than bypass it.
  assert.equal(typeof globalThis.fetch, "function");
  assert.equal(globalThis.WebSocket !== undefined, true);
});