# Production Operations — Nothing But A Dice Roller

This document is the operational runbook for the production roller at `https://nothingbutattrpgdiceroller.netlify.app`.

## Release invariants

- `main` is the production branch. Do not develop directly on it.
- A release must come through the hardening/review workflow with the exact release head green in Full Release Validation, rendered Chrome, CodeQL, and Netlify Deploy Preview.
- Never merge or publish with a known P0/P1 issue or an unaccepted P2 issue.
- Dice mechanics, RAW behavior, Default Dice, ADV/DIS, critical behavior, custom dN behavior, privacy, and production/nonproduction storage isolation are protected release invariants.
- Record the exact known-good commit SHA and Netlify deploy before publishing the next release.

## Synthetic monitoring

`.github/workflows/production-smoke.yml` runs after pushes to `main`, on manual dispatch, and twice hourly on the default branch. It executes `scripts/production-smoke.mjs` against the live production origin.

The synthetic fails if any of these production surfaces regress:

1. the roller homepage is unavailable or loses its expected production markers;
2. the hardened CSP or frame-ancestor policy disappears;
3. the pinned same-origin DiceBox runtime is unavailable;
4. the web app manifest is unavailable or malformed;
5. the public Community endpoint cannot read its Blob-backed data path;
6. the account-data endpoint stops enforcing the unauthenticated boundary.

A failing workflow is a production incident signal. GitHub Actions notifications for this repository should be enabled for the owner/maintainer.

## Deploy and function visibility

Use both platforms during an incident:

- **GitHub Actions:** Full Release Validation, CodeQL, and Production Synthetic Monitor.
- **Netlify:** Deploy logs, Functions logs, project Audit log, and Deploy Preview/production status.
- Configure Netlify deploy-failure notifications to an actively monitored destination. This is an account/project setting and must be manually verified before final release.

Never copy access tokens, Identity tokens, private Blob values, email addresses, or uploaded image data into public issues or workflow logs.

## Incident severity

- **P0:** security/privacy exposure, corrupted public results/mechanics, destructive cross-account data access, or broad production outage. Stop release activity immediately.
- **P1:** core rolling unavailable, sign-in/cloud data broadly unavailable, Community privacy/revocation failure, or persistent production function failure. Roll back or patch immediately.
- **P2:** important but non-destructive regression with a viable workaround. Fix before release unless explicitly accepted.
- **P3:** cosmetic or low-impact issue. Track without weakening release protections.

## Code rollback

Netlify production deploys are atomic. If a newly published release is faulty:

1. Identify the last known-good production deploy and its Git SHA.
2. In Netlify, open the successful previous deploy and publish/restore it as production.
3. Confirm `/`, the pinned DiceBox runtime, and `/api/dice-sets?scope=community&page=1&pageSize=1` are healthy.
4. Re-run or manually dispatch the Production Synthetic Monitor.
5. Keep the bad Git change out of `main` with a revert/fix so a later automatic production deploy does not reintroduce it.
6. Document the incident, affected interval, rollback SHA/deploy, and corrective action.

A Netlify deploy rollback changes the served code/static deploy. **It must not be treated as a Blob-data rollback.**

## Netlify Blob recovery expectations

This application uses site-wide Netlify Blob stores for user configurations, shortcuts, Dice Studio data/images, public projections, moderation/privacy data, and legacy compatibility records. Site-wide stores persist across deploys.

Operational rules:

- Do not run destructive bulk migrations against production Blob data without a separate, verified export/snapshot strategy for the affected records.
- Prefer additive/schema-compatible changes, versioned records, conditional writes, tombstones, and fail-closed cleanup over destructive rewrites.
- Before a one-off destructive maintenance operation, use the Netlify Blobs UI/API to export/download the affected production records and verify the copy can be read before changing production.
- Do not automatically "restore" old Blob data merely because code was rolled back; doing so can overwrite legitimate user activity created after the old deploy.
- Account self-service export is a portability/privacy feature, not a substitute for an operator-level production backup.
- For ambiguous recovery or suspected platform-side loss, preserve current data and contact Netlify support before attempting destructive restoration.

## Security and account controls — final manual verification

The following are external Netlify/GitHub settings, not facts that source code can prove. Verify each immediately before release and record the result in the release review:

- GitHub `main` branch protection/rules require the intended validation checks and block direct/unreviewed production changes.
- Maintainer GitHub account has strong MFA enabled and repository security notifications are monitored.
- Netlify team/owner accounts use MFA/2FA and unnecessary team members are removed.
- Netlify Identity registration/invite policy matches the intended public account flow.
- Netlify environment variables contain only required secrets; stale secrets are removed/rotated and none are committed to Git.
- Function rate limits configured in source are present on the deployed functions; any account-level traffic/WAF rules are reviewed for the plan in use.
- Deploy-failure notifications are enabled to a monitored destination.
- Project/site audit logs are reviewed; team/Identity audit logs are reviewed when the current Netlify plan exposes them.
- Billing/spend controls and usage notifications are configured to avoid an unnoticed runaway-cost incident.

## Release-day verification

After production publish:

1. Confirm the exact Git SHA deployed.
2. Confirm the Production Synthetic Monitor is green.
3. Perform one real standard d20 roll and one custom dN roll on production.
4. Test sign-in/sign-out and one non-destructive cloud read.
5. Verify Community loads without exposing account identity.
6. Confirm the current CSP and security headers on the live homepage.
7. Keep the previous known-good deploy identified until the release has demonstrated stable operation.
