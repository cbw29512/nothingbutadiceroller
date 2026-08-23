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

Phase 2 evidence: exact hardening heads have completed the built-site Chrome matrix for `/`, Dice Studio, shortcut manager, How To, Privacy, Legal, and the admin moderation surface on 1440×900 desktop and 390×844 mobile. The interaction suite also caught and permanently regressed a real `Bolean(active)` shortcut-integration typo that had blocked ordinary Roll clicks.

## Phase 3 — Public image and upload privacy hardening

- [x] Validate actual image file signatures, not only data-URL MIME text. **Server-side binary detection must agree with the declared PNG/JPEG/WebP MIME before Blob storage.**
- [x] Decode and re-encode accepted cloud tray images so metadata such as EXIF/GPS is removed. **Uploads pass structural validation, then Sharp decodes the real pixel stream with strict input bounds, auto-orients it, and re-encodes to the same PNG/JPEG/WebP format. Sharp output metadata preservation is never enabled, so EXIF/GPS/XMP/IPTC/ICC is removed before Blob storage.**
- [x] Enforce safe maximum pixel dimensions / decode bounds. **Uploads are bounded to 4096px per side and 16,777,216 pixels both structurally and by the real decoder.**
- [x] Preserve PNG/JPEG/WebP support without allowing arbitrary payloads disguised as images. **All three formats must pass signature/structure checks and a real Sharp pixel decode; malformed compressed pixel streams fail closed even when their outer container looks plausible. Only the newly re-encoded byte stream is stored.**
- [x] Keep guest 512 KB and cloud 4 MB limits unless measurement justifies a change. **Current contract suite verifies both limits, including a post-reencode 4 MB ceiling.**
- [x] Add an aggregate per-account image/storage quota. **Cloud tray images are capped at 64 MB total per account. New uploads store byte-length metadata; legacy images are safely measured when needed; preflight checks are backed by post-commit verification and conditional rollback so concurrent uploads on different sets cannot leave the account over quota.**
- [x] Add regression tests proving metadata stripping / type rejection / dimension limits. **Adversarial binary fixtures cover PNG text metadata, JPEG EXIF/IPTC/comments, WebP EXIF/XMP, MIME mismatch, unsupported bytes, oversized dimensions, real PNG/JPEG/WebP decode/re-encode, EXIF orientation baking/removal, and deliberately corrupted PNG pixel data.**

Phase 3 evidence: aggregate quota exact head `4b47a45ad8b32ee6afa4c54ceacb6474aabd6a1e` passed the full deterministic/build/browser release validation, CodeQL `security-extended`, and the Netlify Deploy Preview. Full decode/re-encode exact head `f1fdd2efac5697c810ecfb3e107b90a20d451a74` then passed the complete deterministic/build/browser release validation, CodeQL, and Netlify Deploy Preview with Sharp 0.35.3 packaged as a native external module. Regression coverage proves metadata is stripped from real outputs, EXIF orientation is applied before removal, corrupt compressed pixel streams are rejected, only re-encoded bytes reach storage, and quota accounting uses the sanitized output size.

## Phase 4 — Community abuse and scale controls

- [x] Add application-level publication/upload abuse limits or verified Netlify rate-limit controls. **Deployed Netlify function rules cap dice-set save/upload mutations at 30 requests/minute, report submissions at 10 requests/minute, and Community/library requests at 120 requests/minute per IP+domain.**
- [x] Add pagination/bounded page size for Community results. **Community returns 24 records by default, allows at most 48 per page, bounds page numbers, and Dice Studio exposes an explicit Load More flow.**
- [x] Avoid unbounded public-record fan-out on every Community load. **Current Community Blob enumeration uses manual pagination and stops after one bounded candidate page; legacy migration reads are separately capped.**
- [x] Add a user-facing Report Set path. **Signed-in users can report a public set from Dice Studio with a bounded reason/details form; duplicate reports from the same account/set collapse to one private server-side record.**
- [x] Add an administrative takedown/moderation path. **A server-authorized Netlify Identity `admin` queue can take down or lift blocks; takedown writes the block before projection cleanup, blocked sets cannot republish, and lift clears stale public projection state before removing the block.**
- [x] Add concise Community Acceptable Use rules. **Dice Studio states the sharing boundary before the Community list and directs users to report violations.**
- [x] Keep public projections anonymous (`Adventurer`) and opaque. **Current public-projection contract verifies opaque public identity and no account email/internal account IDs; reporter identity also remains server-side and is not rendered to moderators.**

Phase 4 evidence: exact head `9e55ef7d2d5d990ef7b5378c01480f8669eba451` passed Full Release Validation, the desktop/mobile rendered-browser matrix, CodeQL `security-extended`, and the Netlify Deploy Preview. Regression fixtures prove bounded Blob enumeration, private report deduplication, fail-closed moderation blocks, blocked-set republish denial, safe lift ordering, and sanitized typed API errors. GitHub Advanced Security automatically resolved the insecure-randomness and static-server file-race review threads after the fixes landed.

## Phase 5 — Supply-chain and runtime resilience

- [ ] Self-host the pinned DiceBox browser runtime.
- [ ] Self-host the pinned DiceBox runtime assets/models required for standard dice.
- [ ] Remove production execution dependency on jsDelivr/unpkg.
- [ ] Tighten Content-Security-Policy after self-hosting.
- [ ] Add production clickjacking protection (`frame-ancestors`) without breaking Deploy Preview review workflow.
- [ ] Add regression checks proving no remote production module execution is required.

## Phase 6 — Cloud concurrency and data integrity

- [x] Add optimistic concurrency/version protection to Dice Studio cloud records. **Strong ETag reads plus atomic `onlyIfMatch` / `onlyIfNew` owner commits protect saves; stale deletes must first win a conditional tombstone write.**
- [x] Add optimistic concurrency/version protection to saved configurations where appropriate. **The per-user saved-configuration collection now uses strong ETag reads plus `onlyIfMatch` / `onlyIfNew`; stale save/delete operations return a sanitized 409 and the latest collection/version.**
- [x] Preserve the shortcut ETag/version conflict behavior already in place.
- [x] Make Dice Studio/configuration conflicts explicit and recoverable instead of silent last-write-wins. **Dice Studio preserves a stale open draft until the user deliberately reloads; saved configurations refresh the latest list/version while leaving the player's current dice unchanged.**
- [x] Add conflict-path tests for newly protected cloud records. **Release checks inject competing writes between strong reads and conditional writes for both Dice Studio records and saved-configuration collections.**

Phase 6 evidence: Dice Studio exact head `01a3d95206fb5f72b3243100cde6ddaf5e8484fd` passed its injected two-device race plus Chrome. Saved-configuration exact head `09138033585634c2ff143356d45c0299bfb360a1` passed clean deterministic/build/browser validation and CodeQL; its race fixture also verifies conflict payload sanitization and that internal storage exception text does not reach clients.

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

- [x] Remove tracked `node_modules` from the repository while keeping `package-lock.json`. **A tree-level cleanup removed the vendored dependency directory; the normal release check runs `git ls-files` after `npm ci` to prove no installed dependency is tracked.**
- [x] Add `SECURITY.md` with vulnerability reporting guidance. **Policy directs sensitive reports to private GitHub reporting/advisories and forbids posting credentials/exploit details publicly.**
- [x] Add Dependabot configuration for npm and GitHub Actions. **Weekly version updates cover both ecosystems.**
- [x] Add CodeQL/static security scanning. **Dedicated CodeQL v4 JavaScript workflow runs `security-extended` on PRs, main, weekly schedule, and manual dispatch.**
- [ ] Review and retire legacy Theme Studio production surface after compatibility/migration verification.
- [ ] Standardize server error responses so internal error details are not unnecessarily exposed. **Saved configurations and current Community/dice-set moderation endpoints use the shared typed public-error boundary; the remaining public Netlify endpoints are being audited before this is closed.**

Phase 9 security evidence: exact dependency-cleaned head `400b34ab6b4c7cf5c4b0f6215d5aee04b56753b7` passed clean-checkout `npm ci`, the complete deterministic/build/browser release validation, the local DevSecOps contract, and the independent CodeQL `security-extended` analysis.

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
- [x] Security/static-analysis workflow passes. **Exact hardening heads complete CodeQL `security-extended` successfully.**
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
- [x] No unresolved PR review blockers. **GitHub review-thread audit on the Phase 4 checkpoint shows both CodeQL threads resolved.**
- [ ] `main` protection is verified enabled.
- [ ] Final release review finds no P0/P1 findings and no unaccepted P2 findings.
- [ ] Explicit approval is received before merge/release.
