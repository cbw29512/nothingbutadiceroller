# Production UI release — 2026-08-19

This release consolidates the already-approved player/DM dice UI so the completed controls are present in the shipped HTML rather than depending on runtime injection.

Release invariants:

- Seven standard 3D dice remain: d4, d6, d8, d10, d12, d20, d100.
- CUSTOM is the eighth desktop/mobile choice and accepts N or dN up to d1,000,000.
- Standard dice use DiceBox physics.
- CUSTOM uses Web Crypto CSPRNG with rejection sampling and a stylized d20 result display.
- Tray click/tap rolls the selected standard dice.
- Enter/Space rolls when the tray is keyboard-focused.
- ADV/DIS remain immediate one-click d20 quick rolls.
- The tray visibly explains click/tap rolling and identifies the rigid-body physics engine.

This file exists as a release marker for the production deploy and does not alter dice behavior.
