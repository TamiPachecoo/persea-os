// Production Audit — Environment Separation pass. ONE centralized place for
// "which of the three environments is this page running in" — replaces the
// scattered `/^(localhost|127\.0\.0\.1)$/.test(location.hostname)` checks
// that used to live in shared/ui.js and half a dozen individual pages.
//
// Three tiers, by hostname only (see PRODUCTION_HOSTNAMES/DEMO_HOSTNAMES):
//   development — localhost / 127.0.0.1 (a developer's own machine)
//   demo        — persea-os.pachecootami.workers.dev (the shared staging
//                 URL — a deliberately rich, mock-data-populated experience
//                 for Nay to explore before real clients exist)
//   production  — app.naymurta.com (not live yet — listed ahead of time so
//                 this file doesn't need editing again the day it goes
//                 live; until that hostname actually resolves here, nothing
//                 currently visits this code path in "production" mode)
//
// This is environment detection only — hostname, nothing secret — never
// put a real credential in a frontend module. Anything that isn't
// recognized as demo or production is treated as development-like (see
// isNonProduction below): the two demo/staging hostnames are the only
// ones this list needs to grow as new preview/staging URLs show up, and
// erring toward "extra convenience features render" on an unrecognized
// *local* host is the safe direction — erring the other way (locking an
// unrecognized host into production-strict mode) would silently hide
// legitimate dev/demo tooling. Actual security boundaries (auth, RLS,
// financial correctness) never depend on this module — they hold
// regardless of environment.
const PRODUCTION_HOSTNAMES = ['app.naymurta.com'];
const DEMO_HOSTNAMES = ['persea-os.pachecootami.workers.dev'];

export function isLocalDevelopment() {
  return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
}
export function isDemoEnvironment() {
  return DEMO_HOSTNAMES.includes(location.hostname);
}
export function isProductionEnvironment() {
  return PRODUCTION_HOSTNAMES.includes(location.hostname);
}
// 'development' | 'demo' | 'production' — falls back to 'development' for
// any hostname that isn't explicitly the demo or production one (see note
// above on why that's the safe default direction).
export function getEnvironment() {
  if (isProductionEnvironment()) return 'production';
  if (isDemoEnvironment()) return 'demo';
  return 'development';
}
// True in development OR demo — the useful predicate for "safe,
// non-destructive convenience features that help explore/showcase the
// system" (state simulators, the client-role switcher): demo/staging is
// deliberately meant to be a rich, freely-explorable mock experience, not
// just localhost, so these should render there too. Never true in
// production. Distinct from a *destructive* local-only action (e.g.
// wiping all seeded demo data) — those stay gated to isLocalDevelopment()
// specifically, since a public "reset everything" button has no place on
// a shared demo link even though the demo environment otherwise welcomes
// exploration. See app/index.html for that narrower case.
export function isNonProduction() {
  return !isProductionEnvironment();
}
