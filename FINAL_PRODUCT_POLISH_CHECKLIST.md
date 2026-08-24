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

## Site-wide product quality guardrails

These guardrails apply to every polish item and final release check.

- The main roller interaction is protected UX: the dice selector, tray, shortcut toolbar, ADV/DIS controls, roll action, and result remain the primary path. Do not replace them with a marketing hero, onboarding wall, modal, or feature dashboard.
- Preserve the fast guest path. A user must be able to arrive, choose dice, and roll without creating an account or understanding advanced features.
- Secondary features remain secondary: Dice Studio, History, account, help, support, Community, and shortcut management must stay discoverable without competing with the core roll task.
- Mobile changes must preserve the compact fixed play controls and must not introduce horizontal overflow, obscured focus, or difficult touch targets.
- Accessibility target: WCAG 2.2 AA as the technical baseline, including keyboard-only operation, visible focus, labeled controls, logical headings/landmarks, modal focus containment/return, target sizing/spacing, reduced-motion support, and focus not being obscured by sticky/fixed UI. Final acceptance also requires rendered/manual accessibility checks; code review alone is not treated as legal certification.
- SEO target: descriptive unique page titles and descriptions, correct canonical/index/noindex behavior, crawlable public content, robots/sitemap consistency, social metadata, truthful structured data only, and good Core Web Vitals. Never add fake ratings/reviews or keyword-stuffed hidden content.
- The public roller should remain visually clean. SEO support content belongs in genuinely useful visible copy or the indexed How To/help content, not in clutter added above the tray.
- Compare product flow against current high-quality dice utilities and general web conventions, but do not copy another product or add features merely because a competitor has them.
- Every visual change must preserve the existing mechanics/security/privacy browser contracts before it can be checked off.

## Final product-polish items

- [ ] 1. Correct generic natural-1 / natural-20 feedback so a plain d20 never falsely implies universal RAW critical failure/success.
  - Decision: celebrate the rolled number only — `NATURAL 20!` and red `NATURAL 1!`; the table decides what those numbers mean in context.
  - Validation required before checkoff: focused behavior contract must prove both labels and preserve existing single-d20/ADV/DIS outcome detection.
- [ ] 2. Redesign mobile Dice Studio navigation so editing is the primary task and Sets/Community do not block the editor.
  - Decision: mobile Dice Studio opens on `Edit`, with one-tap `Preview`, `Sets`, and `Community` sections. Selecting New Set or an owned set returns to Edit; selecting a preview face returns to Edit; Community remains separate from My Collection.
  - Accessibility/flow requirements: all section controls at least 44px, visible focus, no horizontal overflow, global status remains visible, and desktop Dice Studio layout remains unchanged.
  - Validation required before checkoff: dedicated rendered mobile browser test must prove Edit-first visibility, all four section transitions, New Set handoff, preview-face handoff, target sizes, and no horizontal overflow.
- [ ] 3. Upgrade Dice Studio preview to use the real physical die appearance/geometry where feasible.
  - Decision: use geometry-faithful previews for d4/d6/d8/d10/d12/d20/d100 with distinct tabletop silhouettes and facet overlays while retaining the existing body/face/glow/resin/finish/pattern/inlay appearance plan. Do not load a second physics engine in Dice Studio; the main roller remains the authoritative 3D physics view.
  - Performance/accessibility requirements: no extra DiceBox canvas/runtime in Studio, no horizontal overflow, preview selection remains keyboard/button based, and existing face-selection behavior remains intact.
  - Validation required before checkoff: dedicated rendered browser test must prove seven distinct geometries, facet overlays, preserved appearance attributes, no physics canvas, die selection rerender, and no horizontal overflow.
- [ ] 4. Group advanced Dice Studio controls into clear progressive sections without hiding power-user functionality.
  - Decision: group the existing editor into native progressive sections: `Dice`, `Material`, `Surface`, `Faces`, and `Tray`. `Dice` opens by default; other sections remain one tap/click away and all existing controls stay in the DOM.
  - Flow/accessibility requirements: native keyboard-operable disclosure controls, at least 44px targets on mobile, visible focus, no horizontal overflow, New Set/owned-set selection opens Dice, and selecting a preview face opens Faces and focuses the face editor.
  - Validation required before checkoff: rendered desktop/mobile test must prove all five sections, correct fieldset grouping, no lost controls, target size, New Set handoff, face-edit handoff, and no horizontal overflow.
- [ ] 5. Add a persistent/sticky Dice Studio Save / Use workflow and move destructive/publishing actions out of the primary path.
  - Decision: keep `Save Set` and `Use & Back to Roller` in a sticky primary action bar with clear `Saved` / `Unsaved changes` feedback. Move Lock/Unlock, Publish/Make Private, and Delete under a collapsed `More set actions` disclosure.
  - Accessibility/flow requirements: sticky bar must not obscure focused controls, mobile action targets remain at least 44px, destructive actions remain explicitly labeled, and all existing save/use/lock/publish/delete authorization rules remain unchanged.
  - Validation required before checkoff: desktop/mobile rendered test must prove action placement, sticky positioning, dirty/clean feedback, save recovery, secondary disclosure, mobile target size/focus visibility, and no horizontal overflow.
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
- [ ] WCAG-oriented keyboard/focus/target-size/reduced-motion/focus-obscuring checks green on the rendered site.
- [ ] SEO metadata/canonical/robots/sitemap/indexability contract green for every public page.
- [ ] Core Web Vitals / performance review finds no known release-blocking regression.
- [ ] CodeQL green.
- [ ] Exact-head Netlify Deploy Preview green.
- [ ] Hosted acceptance green for roller, Dice Studio, shortcuts, account boundary, custom dN, and protected mechanics.
- [ ] Final visual/product review finds no known P0/P1 defect and no unaccepted P2 defect.
- [ ] Explicit owner approval before merge/release.
