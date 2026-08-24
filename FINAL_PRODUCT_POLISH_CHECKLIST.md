# Final Product Polish Checklist

Status: ACTIVE
Branch: `polish/final-product-pass-20260823`
Starting certified release candidate: `6c8b852b7793b98a315097654814ca81ae432a99`

This checklist is the source of truth for the final product-polish pass. We will handle one item at a time. An item is checked only after the user decision is recorded, the implementation is complete, and targeted regression/browser validation passes. No unrelated redesigns or mechanics changes.

## Working rules

- One question/decision at a time.
- Implement only the approved behavior.
- Protect canonical dice shapes, RNG, physics, RAW mechanics, Default Dice immutability, ADV/DIS, custom dN security, shortcut behavior, account/privacy boundaries, and production/nonproduction isolation.
- Validate each item before checking it off.
- Do not merge to `main` until the entire pass is complete and a final full certification is green.

## Final product-polish items

- [ ] 1. Correct generic natural-1 / natural-20 feedback so a plain d20 never falsely implies universal RAW critical failure/success.
  - Decision: celebrate the rolled number only — `NATURAL 20!` and red `NATURAL 1!`; the table decides what those numbers mean in context.
  - Validation required before checkoff: focused behavior contract must prove both labels and preserve existing single-d20/ADV/DIS outcome detection.
- [ ] 2. Redesign mobile Dice Studio navigation so editing is the primary task and Sets/Community do not block the editor.
- [ ] 3. Upgrade Dice Studio preview to use the real physical die appearance/geometry where feasible.
- [ ] 4. Group advanced Dice Studio controls into clear progressive sections without hiding power-user functionality.
- [ ] 5. Add a persistent/sticky Dice Studio Save / Use workflow and move destructive/publishing actions out of the primary path.
- [ ] 6. Declutter the mobile roller header while keeping Dice Studio, History, account/help/support accessible.
- [ ] 7. Polish shortcut-manager onboarding/gear affordance without changing the protected shortcut mechanics.
- [ ] 8. Simplify technical custom-die result copy while retaining an accessible secure-random explanation.
- [ ] 9. Add useful roll-history actions such as exact reroll and copy, without changing logged roll semantics.
- [ ] 10. Improve mobile selected-dice visibility with compact quantity feedback while preserving the compact dice row.
- [ ] 11. Evaluate offline/installable basic roller support only after items 1–10 are complete; implement only if it can fail safely for cloud/account features.

## Final certification after all approved items

- [ ] Clean `npm ci` / dependency audit.
- [ ] Full deterministic mechanics/security/privacy contract suite green.
- [ ] Desktop and mobile rendered-browser suite green.
- [ ] CodeQL green.
- [ ] Exact-head Netlify Deploy Preview green.
- [ ] Hosted acceptance green for roller, Dice Studio, shortcuts, account boundary, custom dN, and protected mechanics.
- [ ] Final visual/product review finds no known P0/P1 defect and no unaccepted P2 defect.
- [ ] Explicit owner approval before merge/release.
