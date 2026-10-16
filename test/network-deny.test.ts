import test from "node:test";
import assert from "node:assert/strict";

import {
  DENIED_HOST_SUFFIXES,
  ProductionTargetError,
  PRODUCTION_SUPABASE_HOST,
  TRANSPORT_COVERAGE,
  assertNotDeniedTarget,
  installNetworkDeny,
  isDeniedTarget,
} from "../src/safety/network-deny.ts";

/* -------------------------------------------------------------------------- */
/* Matching — pure, no network                                                 */
/* -------------------------------------------------------------------------- */

test("deny: the observed production Supabase host is denied", () => {
  assert.equal(PRODUCTION_SUPABASE_HOST, "fmfyvplvutcusvxvymxj.supabase.co");
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co/"));
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co/rest/v1/"));
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co/functions/v1/generate-quote"));
});

test("deny: auth and storage paths on the production host are denied", () => {
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co/auth/v1/token"));
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co/storage/v1/bucket"));
});

test("deny: any supabase.co host is denied, not just the observed project", () => {
  assert.ok(isDeniedTarget("https://example.supabase.co/rest/v1/"));
  assert.ok(isDeniedTarget("https://anything-at-all.supabase.co/"));
});

test("deny: observed third-party production services are denied", () => {
  assert.ok(isDeniedTarget("https://api.stripe.com/v1/checkout"));
  assert.ok(isDeniedTarget("https://dashboard.stripe.com/"));
  assert.ok(isDeniedTarget("https://www.google.com/recaptcha/api2/anchor"));
  assert.ok(isDeniedTarget("https://www.reddit.com/"));
});

test("deny: subdomain and case variants are caught", () => {
  assert.ok(isDeniedTarget("https://FMFYVPLVUTCUSXVXMYXJ.SUPABASE.CO/rest/v1/"));
  assert.ok(isDeniedTarget("https://deep.nested.stripe.com/x"));
});

test("deny: userinfo tricks do not evade the guard", () => {
  // URL parsing keeps userinfo out of hostname, so this is still caught.
  assert.ok(isDeniedTarget("https://legit.example.com@fmfyvplvutcusvxvymxj.supabase.co/"));
  assert.ok(isDeniedTarget("https://user:pass@fmfyvplvutcusvxvymxj.supabase.co/rest/v1/"));
});

test("deny: port variations do not evade the guard", () => {
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co:443/rest/v1/"));
  assert.ok(isDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co:8443/rest/v1/"));
});

test("allow: unrelated hosts are not denied", () => {
  assert.equal(isDeniedTarget("https://example.com/"), false);
  assert.equal(isDeniedTarget("http://localhost:54321/rest/v1/"), false); // local Supabase is fine
  assert.equal(isDeniedTarget("http://127.0.0.1:3000/"), false);
  assert.equal(isDeniedTarget("https://registry.npmjs.org/"), false);
});

test("allow: a host that merely contains a denied word is not denied", () => {
  assert.equal(isDeniedTarget("https://notstripe.com/"), false);
  assert.equal(isDeniedTarget("https://supabase.co.example.com/"), false);
});

test("deny: unparseable input does not throw and is not denied", () => {
  assert.equal(isDeniedTarget("not a url"), false);
  assert.equal(isDeniedTarget(""), false);
});

test("assert: throws ProductionTargetError for denied targets", () => {
  assert.throws(
    () => assertNotDeniedTarget("https://fmfyvplvutcusvxvymxj.supabase.co/rest/v1/"),
    ProductionTargetError,
  );
});

test("assert: passes for allowed targets", () => {
  assert.doesNotThrow(() => assertNotDeniedTarget("http://localhost:54321/rest/v1/"));
});

test("deny list is non-empty and includes the production host suffix", () => {
  assert.ok(DENIED_HOST_SUFFIXES.length > 0);
  assert.ok(DENIED_HOST_SUFFIXES.includes("supabase.co"));
});

/* -------------------------------------------------------------------------- */
/* Enforcement — verified WITHOUT any network request                         */
/* -------------------------------------------------------------------------- */

test("enforce: guard refuses BEFORE delegating to the underlying fetch", async () => {
  // The underlying fetch is a stub that counts delegations. If the guard ever
  // failed to intercept, this would record a would-be network call.
  let delegated = 0;
  const prev = globalThis.fetch;
  globalThis.fetch = (async () => {
    delegated += 1;
    return new Response("{}");
  }) as typeof fetch;

  const handle = installNetworkDeny();
  try {
    await assert.rejects(
      async () => {
        await fetch("https://fmfyvplvutcusvxvymxj.supabase.co/rest/v1/jobs");
      },
      (error: unknown) => {
        assert.ok(error instanceof ProductionTargetError);
        const denied = error as ProductionTargetError;
        assert.equal(denied.host, PRODUCTION_SUPABASE_HOST);
        assert.match(denied.message, /no authorization/i);
        return true;
      },
    );

    assert.equal(delegated, 0, "guard must refuse before any socket is opened");
  } finally {
    handle.uninstall();
    globalThis.fetch = prev;
  }
});

test("enforce: guard blocks a range of production endpoints", async () => {
  let delegated = 0;
  const prev = globalThis.fetch;
  globalThis.fetch = (async () => {
    delegated += 1;
    return new Response("{}");
  }) as typeof fetch;

  const handle = installNetworkDeny();
  try {
    const targets = [
      "https://fmfyvplvutcusvxvymxj.supabase.co/functions/v1/create-checkout",
      "https://fmfyvplvutcusvxvymxj.supabase.co/functions/v1/post-to-reddit",
      "https://fmfyvplvutcusvxvymxj.supabase.co/functions/v1/verify-recaptcha",
      "https://api.stripe.com/v1/payment_intents",
    ];
    for (const url of targets) {
      await assert.rejects(
        async () => {
          await fetch(url);
        },
        ProductionTargetError,
        `expected ${url} to be refused`,
      );
    }
    assert.equal(delegated, 0, "no denied request may reach the transport");
  } finally {
    handle.uninstall();
    globalThis.fetch = prev;
  }
});

test("enforce: uninstall restores the previous fetch implementation", () => {
  const before = globalThis.fetch;
  const handle = installNetworkDeny();
  assert.notEqual(globalThis.fetch, before);
  handle.uninstall();
  assert.equal(globalThis.fetch, before);
});

test("enforce: the guard is transparent for non-denied URLs", () => {
  // A local URL is passed through to the original implementation. The call is
  // expected to fail for connectivity reasons, NOT with ProductionTargetError.
  const handle = installNetworkDeny();
  try {
    assert.doesNotThrow(() => assertNotDeniedTarget("http://localhost:54321/rest/v1/"));
  } finally {
    handle.uninstall();
  }
});

/* -------------------------------------------------------------------------- */
/* WebSocket interception                                                       */
/* -------------------------------------------------------------------------- */

/** Install a counting WebSocket stub so no real connection is attempted. */
function withStubbedWebSocket<T>(fn: (counters: { constructed: number }) => T): T {
  const prev = globalThis.WebSocket;
  const counters = { constructed: 0 };
  class StubWebSocket {
    url: string;
    constructor(url: string) {
      this.url = url;
      counters.constructed += 1;
    }
  }
  globalThis.WebSocket = StubWebSocket as unknown as typeof WebSocket;
  try {
    return fn(counters);
  } finally {
    globalThis.WebSocket = prev;
  }
}

test("ws: wss:// to a denied host is refused before the transport is reached", () => {
  withStubbedWebSocket((counters) => {
    const handle = installNetworkDeny();
    try {
      assert.throws(
        () => new WebSocket("wss://fmfyvplvutcusvxvymxj.supabase.co/realtime/v1/websocket"),
        ProductionTargetError,
      );
      assert.equal(counters.constructed, 0, "must refuse before constructing a socket");
    } finally {
      handle.uninstall();
    }
  });
});

test("ws: ws:// variants, ports and userinfo are all refused", () => {
  withStubbedWebSocket((counters) => {
    const handle = installNetworkDeny();
    try {
      const denied = [
        "ws://fmfyvplvutcusvxvymxj.supabase.co/realtime/v1/websocket",
        "wss://fmfyvplvutcusvxvymxj.supabase.co:443/realtime/v1/websocket",
        "wss://user:pass@fmfyvplvutcusvxvymxj.supabase.co/realtime/v1/websocket",
        "wss://legit.example.com@fmfyvplvutcusvxvymxj.supabase.co/x",
        "wss://example.supabase.co/realtime/v1/websocket",
      ];
      for (const url of denied) {
        assert.throws(() => new WebSocket(url), ProductionTargetError, `expected ${url} denied`);
      }
      assert.equal(counters.constructed, 0, "no denied socket may be constructed");
    } finally {
      handle.uninstall();
    }
  });
});

test("ws: control URLs that are not denied hosts are constructed", () => {
  withStubbedWebSocket((counters) => {
    const handle = installNetworkDeny();
    try {
      assert.doesNotThrow(() => new WebSocket("ws://hooks.example.com/x"));
      assert.equal(counters.constructed, 1);
    } finally {
      handle.uninstall();
    }
  });
});

test("ws: loopback WebSocket URLs are allowed for local development", () => {
  withStubbedWebSocket((counters) => {
    const handle = installNetworkDeny();
    try {
      assert.doesNotThrow(() => new WebSocket("ws://localhost:54321/realtime/v1/websocket"));
      assert.doesNotThrow(() => new WebSocket("wss://127.0.0.1:54322/x"));
      assert.equal(counters.constructed, 2);
    } finally {
      handle.uninstall();
    }
  });
});

test("ws: uninstall restores the original WebSocket global", () => {
  withStubbedWebSocket(() => {
    const before = globalThis.WebSocket;
    const handle = installNetworkDeny();
    assert.notEqual(globalThis.WebSocket, before);
    handle.uninstall();
    assert.equal(globalThis.WebSocket, before);
  });
});

test("ws: the proxy preserves instance identity for allowed URLs", () => {
  withStubbedWebSocket(() => {
    // Capture the class the helper actually installed, so instanceof compares
    // against the real target rather than a shadowing declaration.
    const InstalledClass = globalThis.WebSocket as unknown as new (url: string) => { url: string };
    const handle = installNetworkDeny();
    try {
      const instance = new WebSocket("ws://localhost:54321/x");
      assert.ok(instance instanceof InstalledClass, "prototype chain must be preserved");
      assert.equal(instance.url, "ws://localhost:54321/x");
    } finally {
      handle.uninstall();
    }
  });
});

test("ws: coverage reports WebSocket as guarded in a runtime that has it", () => {
  const handle = installNetworkDeny();
  try {
    const ws = handle.coverage.find((c) => c.transport === "globalThis.WebSocket");
    assert.ok(ws, "WebSocket must appear in the coverage matrix");
    assert.equal(ws?.guarded, typeof globalThis.WebSocket === "function");
  } finally {
    handle.uninstall();
  }
});

/* -------------------------------------------------------------------------- */
/* Honest coverage matrix                                                      */
/* -------------------------------------------------------------------------- */

test("coverage: unguarded transports are listed explicitly, not omitted", () => {
  const byName = new Map(TRANSPORT_COVERAGE.map((c) => [c.transport, c]));

  // Known bypasses that must remain recorded as unguarded.
  for (const unguarded of [
    "node:http / node:https",
    "node:dgram (UDP)",
    "XMLHttpRequest (browser)",
    "EventSource (browser)",
    "node:child_process",
    "DNS / TLS / kernel",
  ]) {
    assert.ok(byName.has(unguarded), `${unguarded} must appear in the coverage matrix`);
    assert.equal(byName.get(unguarded)?.guarded, false, `${unguarded} must be marked unguarded`);
  }
});

test("coverage: guarded transports are exactly the ones we actually wrap", () => {
  const guarded = TRANSPORT_COVERAGE.filter((c) => c.guarded).map((c) => c.transport);
  assert.deepEqual(guarded.sort(), ["globalThis.WebSocket", "globalThis.fetch"]);
});

test("coverage: every entry carries a non-empty limitation statement", () => {
  for (const entry of TRANSPORT_COVERAGE) {
    assert.ok(entry.limitation.length > 0, `${entry.transport} must document a limitation`);
    assert.ok(entry.mechanism.length > 0, `${entry.transport} must document a mechanism`);
  }
});

test("coverage: the absence of an environment sandbox is recorded, not glossed", () => {
  const kernel = TRANSPORT_COVERAGE.find((c) => c.transport === "DNS / TLS / kernel");
  assert.equal(kernel?.guarded, false);
  assert.match(kernel?.limitation ?? "", /no network scope/i);
  assert.match(kernel?.limitation ?? "", /NO reliable no-egress sandbox/i);
});

test("coverage: browser harnesses are told interception must cover HTTP and WebSocket", () => {
  const xhr = TRANSPORT_COVERAGE.find((c) => c.transport === "XMLHttpRequest (browser)");
  assert.match(xhr?.limitation ?? "", /MUST wrap/i);
  assert.match(xhr?.limitation ?? "", /WebSocket/i);
});