# Security Policy

## Supported version

Security fixes are applied to the current production line and the active release-hardening branch. Older snapshots, forks, and archived builds are not supported.

## Reporting a vulnerability

Please report security issues privately whenever possible. Use GitHub's **Security** tab and choose **Report a vulnerability** / a private security advisory if that option is available for this repository.

If private reporting is unavailable, open a normal GitHub issue that says only that you found a security problem and asks for a private contact path. **Do not post exploit details, credentials, tokens, private user data, or a working proof of concept in a public issue.**

Useful private reports include:

- the affected page, API route, or feature;
- the security impact and who could be affected;
- clear reproduction steps using test data;
- browser/runtime details when relevant;
- a minimal proof of concept that does not access other users' data;
- any suggested mitigation.

## Scope priorities

High-priority reports include authentication or authorization bypass, account or cloud-data exposure, cross-user modification, Community privacy leaks, upload/parser bypasses, stored or reflected script execution, secret disclosure, dependency compromise, and ways to alter canonical dice results or RAW behavior through appearance/customization data.

## Safe testing

Use only accounts and data you own or have explicit permission to test. Do not perform denial-of-service testing, bulk account creation, spam Community publication, destructive tests against production data, credential attacks, or attempts to access another person's records.

## Response and disclosure

Reports will be triaged by severity and reproducibility. A fix may be developed privately and released before technical details are discussed publicly. Please allow a reasonable remediation window before disclosure and coordinate disclosure timing for issues that could put users or their data at risk.

## Secrets

Never commit secrets to this repository or include them in screenshots, logs, issues, or pull requests. If a credential is exposed, treat it as compromised and rotate/revoke it rather than relying on deletion from Git history.
