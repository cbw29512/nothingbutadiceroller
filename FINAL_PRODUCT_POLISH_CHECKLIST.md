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
  - Decision: mobile header exposes four primary controls — `Sound`, `Dice Studio`, `History`, and `More`. `More` contains Sign In/My Dice, How To & Help, and Support Project. Desktop keeps the existing full header.
  - Accessibility/flow requirements: primary and menu targets at least 44px, Escape/outside-click closure, account drawer returns focus to the mobile account opener, no horizontal overflow, and protected tray/dice controls remain untouched.
  - Validation required before checkoff: rendered mobile/desktop test must prove visibility rules, menu links, account drawer focus return, Escape behavior, target sizes, desktop preservation, tray/dice structural preservation, and no horizontal overflow.
- [ ] 7. Polish shortcut-manager onboarding/gear affordance without changing the protected shortcut mechanics.
  - Decision: keep the small gear attached to Roll. Before shortcuts exist, show `Customize roll shortcuts → ⚙`; after at least one shortcut exists, remove the first-use hint and label the toolbar `My shortcuts`. Detail help reads `Hold or focus for details` so touch and keyboard behavior are both understandable.
  - Mechanics/accessibility requirements: 24-slot limit, RAW/Homebrew compilation, toolbar rows, persistence, press behavior, and prepared-roll execution remain unchanged; gear remains available in guest mode and keyboard focus continues to reveal shortcut details.
  - Validation required before checkoff: deterministic integration contract plus rendered mobile test must prove first-use copy, gear availability, configured-hint retirement, My shortcuts state, keyboard detail reveal, and unchanged storage/toolbar mechanics.
- [ ] 8. Simplify technical custom-die result copy while retaining an accessible secure-random explanation.
  - Decision: primary custom-die presentation shows the rolled `dN` value plus `Secure random • range 1–N`. The implementation terminology is removed from the primary breakdown and placed under a collapsed `How randomness works` disclosure.
  - Security/accessibility requirements: Web Crypto `getRandomValues` and rejection sampling remain unchanged; the disclosure explains `Web Crypto CSPRNG + rejection sampling`, is keyboard-operable with a 44px mobile target, and no custom result may imply physical 3D resolution.
  - Validation required before checkoff: deterministic build contract plus rendered mobile test must prove result range, concise primary copy, collapsed technical proof, Web Crypto/rejection-sampling explanation, target size, and no horizontal overflow.
- [ ] 9. Add useful roll-history actions such as exact reroll and copy, without changing logged roll semantics.
  - Decision: every history entry gets `Copy`. New standard and custom rolls also get `Reroll` through a validated replay descriptor; legacy, shortcut, malformed, or otherwise non-replayable entries fail closed with Reroll disabled instead of reconstructing a request from display text.
  - Mechanics/accessibility requirements: standard reroll reuses the original canonical dice pool and ADV/DIS mode while preserving the user's currently selected dice; custom reroll reuses the original dN size; Copy emits stable plain text and never mutates history; mobile history actions are at least 44px.
  - Validation required before checkoff: deterministic replay-descriptor contract plus rendered browser test must prove exact standard replay, preservation of current selection, stable Copy output, fail-closed legacy/unsupported behavior, and unchanged history totals/breakdowns.
- [ ] 10. Improve mobile selected-dice visibility with compact quantity feedback while preserving the compact dice row.
  - Decision: each mobile canonical die button keeps its existing label and gains a compact count badge only while that die is selected. Counts update immediately on add, chip removal, and Clear; unselected dice show no badge.
  - Accessibility/layout requirements: accessible labels announce the selected count and add-another action, the existing seven-button mobile row and minimum target size remain intact, and badges stay inside each button without widening the row or changing selection mechanics.
  - Validation required before checkoff: rendered mobile test must prove multi-die counts, decrement and Clear synchronization, accessible labels, protected button height, and zero row/page horizontal overflow.
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
