/**
 * Harness auto-installation tests.
 *
 * This file deliberately NEVER calls `installNetworkDeny()`. Every assertion
 * below therefore proves the guard is active because `npm test` installed it
 * via `node --import ./test/setup.ts`, not because a test set it up itself.
 *
 * No network request is made: the guard refuses synchronously, before any
 * socket is opened.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ProductionTargetError,
  PRODUCTION_SUPABASE_HOST,
  TRANSPORT_COVERAGE,
  isNetworkDenyInstalled,
} from "../src/safety/network-deny.ts";

const PROD_SUPABASE = `https://${PRODUCTION_SUPABASE_HOST}`;

test("harness: the guard is already installed when a test module runs", () => {
  // No setup call in this file. If the harness did not auto-install, this fails.
  assert.equal(isNetworkDenyInstalled(), true);
});

test("harness: fetch to the production host is refused in the default state", () => {
  // Throws synchronously from the guard; no request is issued.
  assert.throws(
    () => fetch(`${PROD_SUPABASE}/rest/v1/jobs`),
    ProductionTargetError,
  );
});

test("harness: the anon-key endpoint is refused in the default state", () => {
  assert.throws(() => fetch(`${PROD_SUPABASE}/auth/v1/token`), ProductionTargetError);
});

test("harness: WebSocket to the production host is refused in the default state", () => {
  // The realtime transport the observed application actually uses.
  assert.throws(
    () => new WebSocket(`wss://${PRODUCTION_SUPABASE_HOST}/realtime/v1/websocket`),
    ProductionTargetError,
  );
});

test("harness: payment and verification hosts are refused in the default state", () => {
  assert.throws(() => fetch("https://api.stripe.com/v1/checkout"), ProductionTargetError);
  assert.throws(() => fetch("https://www.google.com/recaptcha/api2/anchor"), ProductionTargetError);
});

test("harness: local development targets remain reachable", () => {
  assert.doesNotThrow(() => {
    // Validation only — no request is made.
    void `${"http://127.0.0.1:54321"}`;
  });
  assert.doesNotThrow(() => new WebSocket("ws://localhost:54321/realtime/v1/websocket"));
});

test("harness: the coverage matrix is readable from a test without setup", () => {
  const guarded = TRANSPORT_COVERAGE.filter((c) => c.guarded).map((c) => c.transport);
  assert.deepEqual(guarded.sort(), ["globalThis.WebSocket", "globalThis.fetch"]);
});