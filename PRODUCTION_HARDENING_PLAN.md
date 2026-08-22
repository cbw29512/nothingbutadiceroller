# Production Hardening Plan — 10/10 Target

Status: ACTIVE
Branch: `hardening/production-10-of-10`
Baseline main SHA: `679883b65e7be8ea13f4a250cd1bd24bf957a10c`

This checklist is the release-readiness source of truth. An item is checked only after the change is implemented and a regression check exists or the operational control is verified.

## Release rules

- Never develop directly on `main`.
- Never merge without a final full audit, green automated validation, green Netlify Deploy Preview, and explicit release approval.
- Protect dice mechanics, RAW behavior, Default Dice immutability, ADV/DIS, critical behavior, shortcut behavior, account ownership, privacy, and production/nonproduction storage isolation.
- Prefer small, auditable changes. No unrelated redesigns during hardening.
- Keep the main roller simple and mobile-first.

## Phase 1 — Immediate correctness and repository safety

- [ ] Enable real GitHub branch protection/rules for `main` and require the full validation status before merge. **Operational GitHub setting; cannot be considered complete from source code alone.**
- [ ] Stop runtime code from renaming `Dice Studio` back to `Customize`.
- [ ] Stop runtime auth markup from restoring the misleading word `permanently`.
- [ ] Fix exact-zero Homebrew shortcut damage/healing presentation so legal `0` values render as zero instead of `—` / `Grouped`.
- [ ] Add regression checks for all three runtime/correctness defects above.

## Phase 2 — Browser-level release gates

- [ ] Add real browser smoke tests for the built app.
- [ ] Test desktop and mobile viewports.
- [ ] Assert post-boot UI text so runtime DOM regressions are caught.
- [ ] Assert no horizontal overflow on primary pages.
- [ ] Add baseline automated accessibility checks.
- [ ] Keep browser/E2E tests separate from dice mechanics and deterministic contract tests.

## Phase 3 — Public image and upload privacy hardening

- [ ] Validate actual image file signatures, not only data-URL MIME text.
- [ ] Decode and re-encode accepted cloud tray images so metadata such as EXIF/GPS is removed.
- [ ] Enforce safe maximum pixel dimensions / decode bounds.
- [ ] Preserve PNG/JPEG/WebP support without allowing arbitrary payloads disguised as images.
- [ ] Keep guest 512 KB and cloud 4 MB limits unless measurement justifies a change.
- [ ] Add an aggregate per-account image/storage quota.
- [ ] Add regression tests proving metadata stripping / type rejection / dimension limits.

## Phase 4 — Community abuse and scale controls

- [ ] Add application-level publication/upload abuse limits or verified Netlify rate-limit controls.
- [ ] Add pagination/bounded page size for Community results.
- [ ] Avoid unbounded public-record fan-out on every Community load.
- [ ] Add a user-facing Report Set path.
- [ ] Add an administrative takedown/moderation path.
- [ ] Add concise Community Acceptable Use rules.
- [ ] Keep public projections anonymous (`Adventurer`) and opaque.

## Phase 5 — Supply-chain and runtime resilience

- [ ] Self-host the pinned DiceBox browser runtime.
- [ ] Self-host the pinned DiceBox runtime assets/models required for standard dice.
- [ ] Remove production execution dependency on jsDelivr/unpkg.
- [ ] Tighten Content-Security-Policy after self-hosting.
- [ ] Add production clickjacking protection (`frame-ancestors`) without breaking Deploy Preview review workflow.
- [ ] Add regression checks proving no remote production module execution is required.

## Phase 6 — Cloud concurrency and data integrity

- [ ] Add optimistic concurrency/version protection to Dice Studio cloud records.
- [ ] Add optimistic concurrency/version protection to saved configurations where appropriate.
- [ ] Preserve the shortcut ETag/version conflict behavior already in place.
- [ ] Make conflicts explicit and recoverable instead of silent last-write-wins.
- [ ] Add conflict-path tests.

## Phase 7 — Privacy lifecycle

- [ ] Stop storing unused Identity profile names in dice-set owner records.
- [ ] Add self-service deletion of application cloud data.
- [ ] Define/document data retention behavior.
- [ ] Add a practical account/data export path if feasible for this product scope.
- [ ] Ensure delete/private operations keep public image/projection revocation fail-closed.

## Phase 8 — Accessibility and ease of use

- [ ] Add dialog focus placement, focus trap/containment, and focus restoration for drawers.
- [ ] Prevent background interaction while modal drawers are open.
- [ ] Add `prefers-reduced-motion` treatment for critical effects and nonessential animation.
- [ ] Review primary mobile touch targets without making the interface larger than necessary.
- [ ] Keep the primary roller flow: choose dice → roll → result.

## Phase 9 — Repository and DevSecOps hygiene

- [ ] Remove tracked `node_modules` from the repository while keeping `package-lock.json`.
- [ ] Add `SECURITY.md` with vulnerability reporting guidance.
- [ ] Add Dependabot configuration for npm and GitHub Actions.
- [ ] Add CodeQL/static security scanning.
- [ ] Review and retire legacy Theme Studio production surface after compatibility/migration verification.
- [ ] Standardize server error responses so internal error details are not unnecessarily exposed.

## Phase 10 — Performance, polish, and operations

- [ ] Remove redundant stylesheet loading/imports.
- [ ] Bundle/optimize Dice Studio production JavaScript where useful.
- [ ] Measure bundle/page performance before making speculative optimizations.
- [ ] Add favicon/app icon and social preview metadata.
- [ ] Add sitemap/manifest/structured metadata where useful.
- [ ] Establish uptime/synthetic monitoring for the production roller.
- [ ] Establish production error alerting and function-failure visibility.
- [ ] Establish rollback/incident steps and verify backup/recovery expectations for Netlify Blob data.
- [ ] Verify Netlify operational controls: team MFA/2FA, Identity policy, audit logs where plan supports them, firewall/rate limits, secrets, spending alerts.

## Final 10/10 release gate

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] Full deterministic contract/build suite passes.
- [ ] Browser/E2E suite passes on desktop and mobile targets.
- [ ] Security/static-analysis workflow passes.
- [ ] Netlify Deploy Preview is green for the exact release head.
- [ ] Manual visual acceptance passes on the exact Deploy Preview.
- [ ] Authentication lifecycle passes.
- [ ] Guest/browser persistence lifecycle passes.
- [ ] Cloud save/edit/reload lifecycle passes.
- [ ] Community publish/private/republish/delete lifecycle passes.
- [ ] Public image privacy/revocation checks pass.
- [ ] Default Dice immutable fallback checks pass.
- [ ] RAW/ADV/DIS/critical/custom-dN/shortcut mechanics checks pass.
- [ ] Production/nonproduction storage-isolation checks pass.
- [ ] No unresolved PR review blockers.
- [ ] `main` protection is verified enabled.
- [ ] Final release review finds no P0/P1 findings and no unaccepted P2 findings.
- [ ] Explicit approval is received before merge/release.
