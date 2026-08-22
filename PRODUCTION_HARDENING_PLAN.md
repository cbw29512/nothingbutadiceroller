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

- [ ] Enable real GitHub branch protection/rules for `main` and require the full validation status before merge. **Operational GitHub setting; source audit confirms this is still disabled.**
- [x] Stop runtime code from renaming `Dice Studio` back to `Customize`.
- [x] Stop runtime auth markup from restoring the misleading word `permanently`.
- [x] Fix exact-zero Homebrew shortcut damage/healing presentation so legal `0` values render as zero instead of `—` / `Grouped`.
- [x] Add regression checks for all three runtime/correctness defects above.

Phase 1 code status: implemented on the hardening branch. Branch protection remains an external repository-setting gate and must be verified before release.

## Phase 2 — Browser-level release gates

- [x] Add real browser smoke tests for the built app. **Verified in hosted Google Chrome; includes a real physical d20 roll and mobile CUSTOM d37 roll.**
- [x] Test desktop and mobile viewports.
- [x] Assert post-boot UI text so runtime DOM regressions are caught.
- [x] Assert no horizontal overflow on primary pages.
- [x] Add baseline automated accessibility checks.
- [x] Keep browser/E2E tests separate from dice mechanics and deterministic contract tests.

Phase 2 evidence: exact hardening heads have completed the built-site Chrome matrix for `/`, Dice Studio, shortcut manager, How To, Privacy, and Legal on 1440×900 desktop and 390×844 mobile. The interaction suite also caught and permanently regressed a real `Bolean(active)` shortcut-integration typo that had blocked ordinary Roll clicks.

## Phase 3 — Public image and upload privacy hardening

- [x] Validate actual image file signatures, not only data-URL MIME text. **Server-side binary detection must agree with the declared PNG/JPEG/WebP MIME before Blob storage.**
- [ ] Decode and re-encode accepted cloud tray images so metadata such as EXIF/GPS is removed. **Known PNG/JPEG/WebP metadata containers are now stripped structurally, but full decode/re-encode remains intentionally open.**
- [x] Enforce safe maximum pixel dimensions / decode bounds. **Uploads are bounded to 4096px per side and 16,777,216 pixels before storage.**
- [ ] Preserve PNG/JPEG/WebP support without allowing arbitrary payloads disguised as images. **Structural image validation is now substantially stronger, but this remains open until a real decoder/re-encoder proves the pixel stream.**
- [x] Keep guest 512 KB and cloud 4 MB limits unless measurement justifies a change. **Current contract suite verifies both limits.**
- [ ] Add an aggregate per-account image/storage quota.
- [x] Add regression tests proving metadata stripping / type rejection / dimension limits. **Adversarial binary fixtures cover PNG text metadata, JPEG EXIF/IPTC/comments, WebP EXIF/XMP, MIME mismatch, unsupported bytes, and oversized dimensions.**

## Phase 4 — Community abuse and scale controls

- [ ] Add application-level publication/upload abuse limits or verified Netlify rate-limit controls.
- [ ] Add pagination/bounded page size for Community results.
- [ ] Avoid unbounded public-record fan-out on every Community load.
- [ ] Add a user-facing Report Set path.
- [ ] Add an administrative takedown/moderation path.
- [ ] Add concise Community Acceptable Use rules.
- [x] Keep public projections anonymous (`Adventurer`) and opaque. **Current public-projection contract verifies opaque public identity and no account email/internal account IDs.**

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
- [x] Preserve the shortcut ETag/version conflict behavior already in place.
- [ ] Make Dice Studio/configuration conflicts explicit and recoverable instead of silent last-write-wins.
- [ ] Add conflict-path tests for newly protected cloud records.

## Phase 7 — Privacy lifecycle

- [x] Stop storing unused Identity profile names in new dice-set owner records. **New writes store only the generic `Adventurer` creator label; historical-record cleanup remains a migration task and must not race cloud edits.**
- [ ] Add self-service deletion of application cloud data.
- [ ] Define/document data retention behavior.
- [ ] Add a practical account/data export path if feasible for this product scope.
- [ ] Ensure delete/private operations keep public image/projection revocation fail-closed.

## Phase 8 — Accessibility and ease of use

- [x] Add dialog focus placement, focus trap/containment, and focus restoration for drawers. **Chrome interaction test verifies History drawer focus entry, Tab containment, and focus return.**
- [x] Prevent background interaction while modal drawers are open. **Background surfaces are `inert` and browser-tested while the drawer is active.**
- [x] Add `prefers-reduced-motion` treatment for critical effects and nonessential animation. **CDP emulation verifies the critical banner computes to no animation.**
- [x] Review primary mobile touch targets without making the interface larger than necessary. **d20, ADV/DIS, and Roll are browser-enforced at >=44 px while preserving the eight-column dice row.**
- [x] Keep the primary roller flow: choose dice → roll → result. **The browser gate performs this flow against the real DiceBox-backed d20 path.**

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

- [x] `npm ci` succeeds from a clean GitHub Actions checkout.
- [x] Full deterministic contract/build suite passes on the current hardening line.
- [x] Browser/E2E suite passes on desktop and mobile targets.
- [ ] Security/static-analysis workflow passes.
- [ ] Netlify Deploy Preview is green for the exact release head.
- [ ] Manual visual acceptance passes on the exact Deploy Preview.
- [ ] Authentication lifecycle passes.
- [ ] Guest/browser persistence lifecycle passes.
- [ ] Cloud save/edit/reload lifecycle passes.
- [ ] Community publish/private/republish/delete lifecycle passes.
- [ ] Public image privacy/revocation checks pass.
- [x] Default Dice immutable fallback checks pass in the deterministic contract suite.
- [x] RAW/ADV/DIS/critical/custom-dN/shortcut mechanics checks pass in the deterministic contract suite; normal d20 and custom d37 also pass the real-browser interaction gate.
- [x] Production/nonproduction storage-isolation checks pass in the deterministic contract suite.
- [ ] No unresolved PR review blockers.
- [ ] `main` protection is verified enabled.
- [ ] Final release review finds no P0/P1 findings and no unaccepted P2 findings.
- [ ] Explicit approval is received before merge/release.
