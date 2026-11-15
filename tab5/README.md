# Tab5 Universal Dice Console — firmware foundation

Status: **minimal dice-rolling appliance specification + portable rules-engine prototype**, not flashed onto the Tab5.

## Definition of Done (V1)

- Boot shows game-system selection; after confirmation, system stays locked until reboot.
- No Back/Home/system-switch control while a session is active.
- Top ~30% of the 1280×720 display contains large game-specific touch controls.
- Bottom ~70% displays animated individual dice, visible faces, results, and a persistent total.
- Every die is inspectable, including large pools; scrolling may be needed, but never silently truncate results.
- Offline-only operation; no cloud, phone, Netlify or Wi-Fi requirement.
- Native ESP32-P4 implementation uses a verified CSPRNG/entropy source and unbiased rejection sampling.
- All supplied system dice (including proprietary shapes, symbols, face maps and game-specific result interpretation) must be accurate from V1; never substitute a standard d6/d20 unless the rules actually use one.
- Standard and system-specific dice use the same secure numerical engine, with independent raw face and interpreted result; animation only visualizes results.
- No user-created custom dice, Dice Studio, themes, community marketplace, accounts, cloud sync, or customization screen in V1.
- Only game selection at boot and roll-related controls in session. No navigation controls after confirmation.
- Each game profile defines die faces, face values, roll modifiers, success interpretation and quick actions.
- Preserve individual faces, pool total, and selected/discarded dice in history; do not add a history management screen unless needed to inspect large rolls.
- Correct display for symbolic dice: keep each original face visible and present the system-specific success/effect summary separately; some systems do not have a meaningful numeric total.
- Device wiping/flashing happens only after firmware and backups have been verified.

## Physics presentation contract (V1)

- After pressing Roll, individual dice tumble, translate, spin, bounce off tray boundaries and collide with other dice until they settle.
- Use a real time-step-based collision/physics simulation, not a canned GIF or a series of arbitrary result screens.
- The unbiased secure RNG fixes each die's actual game face; simulation influences only presentation and must never overwrite a rolled face.
- Support authentic standard polyhedral shapes and system-specific marked faces; implementation may use optimized 3D meshes, with measured ESP32-P4 frame rates.
- Sound is tied to actual simulated contacts, with a limiter to avoid loud multi-die rolls.
- Large pools may reduce rendering detail for performance, but every die and raw result remains inspectable.
- Verify native display acceleration, LVGL and frame-buffer performance before choosing the 3D rendering implementation. Do not assume browser DiceBox is portable to ESP32-P4.
- Phase 2 (not V1): saved spell and attack shortcuts, e.g. Fireball 8d6. No shortcuts or customization UI in the initial firmware.

## V1 interaction contract

- Power on → select a supported game → confirm → session-locked dice screen.
- Top ~30%: large die/pool/advantage or game-specific action buttons, and Roll/Clear as appropriate.
- Bottom ~70%: animated dice, each individually identified with its raw face/result, and a persistent result summary.
- On a large pool, shrink/flow/scroll results without hiding or dropping dice; the result summary remains visible.
- Buttons and dice rendering change automatically with the selected system. No customization menu or system switch button during play.
- The only supported V1 extension path is preinstalled, source-verified game profiles; custom user-defined dice are deferred.
- Maintain a tested, versioned registry of game editions and their face maps, probabilities and interpretations; do not infer mechanics from system names.

## Source architecture

The current web roller uses DiceBox 3D physics for standard polyhedrals and
Web Crypto + rejection sampling for custom dN rolls. This folder DOES NOT alter
the live website. The portable JS model verifies the future firmware behavior.
It is NOT Tab5 firmware or a hardware RNG implementation.

## State and rules contracts

- `phase`: `choose` | `confirm` | `session`
- `selectedSystemId`: null until chosen; immutable in `session`
- `pool`: ordered die requests, individually identified
- `roll`: immutable list of per-die raw faces + interpretation + overall total
- `history`: append-only bounded recent rolls
- Restart resets phase to `choose`, even if preferences are persisted.
- Explicitly model selection vs rolling; never use a die animation as randomness.
- Each die must map equal-probability raw integers to its face set.
- Advantage/disadvantage uses TWO d20s and marks the excluded die.

## Known scope boundaries

Do not erase the microSD card without separate authorization. Pocket DM and
the current dice-roller web deployment are untouched by this branch.
Rules for commercial game systems require versioned source verification.
No claim is made that unverified game profiles are ready.

## Testing

Run `node --test tab5/*.test.mjs` on Node.js 22+.
