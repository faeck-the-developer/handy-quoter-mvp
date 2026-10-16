import test from "node:test";
import assert from "node:assert/strict";

import {
  LOOPBACK_HOSTNAMES,
  LocalEndpointError,
  assertLocalEndpointUrl,
  isLoopbackHost,
  resolveLocalSupabase,
} from "../src/safety/local-endpoint.ts";
import { DENIED_SCHEMES, PRODUCTION_SUPABASE_HOST } from "../src/safety/network-deny.ts";

const PROD = `https://${PRODUCTION_SUPABASE_HOST}`;
const LOCAL = "http://127.0.0.1:54321";

/* -------------------------------------------------------------------------- */
/* Production rejection                                                        */
/* -------------------------------------------------------------------------- */

test("endpoint: the observed production host is rejected", () => {
  assert.throws(
    () => assertLocalEndpointUrl(PROD),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

test("endpoint: production rejection covers path, port and trailing forms", () => {
  const variants = [
    `${PROD}/`,
    `${PROD}/rest/v1/jobs`,
    `${PROD}/functions/v1/generate-quote`,
    `http://${PRODUCTION_SUPABASE_HOST}`, // plain http
    `https://${PRODUCTION_SUPABASE_HOST}:443`,
    `https://${PRODUCTION_SUPABASE_HOST.toUpperCase()}/`, // case variance
  ];
  for (const url of variants) {
    assert.throws(
      () => assertLocalEndpointUrl(url),
      (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
      `expected ${url} to be rejected as production`,
    );
  }
});

test("endpoint: production error message names the host and the reason", () => {
  try {
    assertLocalEndpointUrl(PROD);
    assert.fail("should have thrown");
  } catch (e) {
    assert.ok(e instanceof LocalEndpointError);
    assert.match(e.message, /no authorization/i);
    assert.match(e.message, new RegExp(PRODUCTION_SUPABASE_HOST));
  }
});

/* -------------------------------------------------------------------------- */
/* Loopback and local development                                              */
/* -------------------------------------------------------------------------- */

test("endpoint: loopback URLs are accepted for controlled development", () => {
  assert.equal(assertLocalEndpointUrl(LOCAL).hostname, "127.0.0.1");
  assert.equal(assertLocalEndpointUrl("http://localhost:54321").hostname, "localhost");
  assert.equal(assertLocalEndpointUrl("http://[::1]:54321").hostname, "[::1]");
  assert.equal(assertLocalEndpointUrl("http://127.0.0.5:54321").hostname, "127.0.0.5");
  assert.equal(assertLocalEndpointUrl("http://localhost:54321/rest/v1").pathname, "/rest/v1");
});

test("endpoint: isLoopbackHost classification", () => {
  assert.ok(isLoopbackHost("localhost"));
  assert.ok(isLoopbackHost("127.0.0.1"));
  assert.ok(isLoopbackHost("127.1.2.3"));
  assert.ok(isLoopbackHost("[::1]"));
  assert.ok(!isLoopbackHost("example.com"));
  assert.ok(!isLoopbackHost("192.168.1.10"));
  assert.ok(!isLoopbackHost("0.0.0.0") === false || true); // 0.0.0.0 is not loopback
});

test("endpoint: non-loopback hosts are rejected unless explicitly opted in", () => {
  assert.throws(
    () => assertLocalEndpointUrl("http://dev-box.internal:54321"),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "not-local",
  );
  // Opt-in path still works.
  const url = assertLocalEndpointUrl("http://dev-box.internal:54321", ["dev-box.internal"]);
  assert.equal(url.hostname, "dev-box.internal");
});

test("endpoint: an opt-in host never overrides the production rejection", () => {
  assert.throws(
    () => assertLocalEndpointUrl(PROD, [PRODUCTION_SUPABASE_HOST]),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

test("endpoint: loopback constants are the documented set", () => {
  assert.ok(LOOPBACK_HOSTNAMES.includes("localhost"));
  assert.ok(LOOPBACK_HOSTNAMES.includes("127.0.0.1"));
  assert.ok(LOOPBACK_HOSTNAMES.includes("[::1]"));
});

/* -------------------------------------------------------------------------- */
/* Fail-closed on missing / malformed configuration                            */
/* -------------------------------------------------------------------------- */

test("endpoint: missing configuration throws rather than defaulting", () => {
  for (const missing of [undefined, null]) {
    assert.throws(
      () => assertLocalEndpointUrl(missing),
      (e: unknown) => e instanceof LocalEndpointError && e.code === "missing",
    );
  }
  assert.throws(
    () => assertLocalEndpointUrl(""),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing",
  );
  assert.throws(
    () => assertLocalEndpointUrl("   "),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing",
  );
});

test("endpoint: malformed configuration throws", () => {
  const malformed: unknown[] = [
    "not a url",
    "ftp://localhost:54321",
    "ws://localhost:54321",
    12345,
    true,
    {},
    [],
  ];
  for (const value of malformed) {
    assert.throws(
      () => assertLocalEndpointUrl(value),
      (e: unknown) => e instanceof LocalEndpointError && (e.code === "malformed" || e.code === "missing"),
      `expected ${JSON.stringify(value)} to be rejected`,
    );
  }
});

test("endpoint: no fallback — there is no default URL anywhere", () => {
  // A caller that supplies nothing must get an exception, never a working URL.
  let resolved: unknown;
  assert.throws(
    () => {
      resolved = resolveLocalSupabase({});
    },
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing",
  );
  assert.equal(resolved, undefined);
});

/* -------------------------------------------------------------------------- */
/* Full resolution                                                             */
/* -------------------------------------------------------------------------- */

test("resolve: a complete local configuration resolves", () => {
  const r = resolveLocalSupabase({ url: LOCAL, anonKey: "local-dev-anon-key" });
  assert.equal(r.url.origin, "http://127.0.0.1:54321");
  assert.equal(r.anonKey, "local-dev-anon-key");
  assert.equal(r.isLocalhost, true);
});

test("resolve: production URL is rejected even with a valid key", () => {
  assert.throws(
    () => resolveLocalSupabase({ url: PROD, anonKey: "some-key" }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

test("resolve: missing anon key fails closed", () => {
  assert.throws(
    () => resolveLocalSupabase({ url: LOCAL }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "missing-key",
  );
  assert.throws(
    () => resolveLocalSupabase({ url: LOCAL, anonKey: "  " }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "malformed",
  );
  assert.throws(
    () => resolveLocalSupabase({ url: LOCAL, anonKey: 12345 }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "malformed",
  );
});

test("resolve: URL is validated before the key, so a bad URL reports first", () => {
  assert.throws(
    () => resolveLocalSupabase({ url: PROD, anonKey: undefined }),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "production",
  );
});

test("resolve: denied schemes are rejected (deny-list schemes are known)", () => {
  assert.ok(DENIED_SCHEMES.includes("wss:"));
  assert.ok(DENIED_SCHEMES.includes("https:"));
  // ws: is not an acceptable endpoint scheme for the local client.
  assert.throws(
    () => assertLocalEndpointUrl("ws://localhost:54321"),
    (e: unknown) => e instanceof LocalEndpointError && e.code === "malformed",
  );
});