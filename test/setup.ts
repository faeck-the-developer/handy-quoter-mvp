/**
 * Test harness setup — auto-installed by `npm test`.
 *
 * Loaded via `node --import` so the guard is in place BEFORE any test module
 * is evaluated. Tests therefore cannot accidentally run unguarded by forgetting
 * an explicit `installNetworkDeny()` call.
 *
 * This installs a JavaScript-level guard rail only. It is not a sandbox and not
 * a network-isolation boundary — see `docs/network-safety.md`.
 */

import { installNetworkDeny } from "../src/safety/network-deny.ts";

const handle = installNetworkDeny();

// Keep a reference so the handle is not garbage-collected and the uninstall
// path remains reachable for debugging. Tests may call uninstall() and
// reinstall; there is deliberately no auto-reinstall on process exit.
(globalThis as Record<symbol, unknown>)[Symbol.for("handy-quoter.network-deny.handle")] = handle;