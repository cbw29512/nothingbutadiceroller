# Tab5 Universal Dice Console — firmware foundation

Status: **initial native ESP32-P4 v1.x dice firmware and large polyhedral visual prototype**. Native and host tests are required before any on-device verification. The built-in motion is visual-only bounce, not full 3D dynamics.

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

## Automatic orientation contract (V1; required before release)

- M5Stack Tab5 has a BMI270 6-axis IMU. Monitor gravity via its accelerometer to detect portrait, landscape, and 180-degree reversals.
- Rotate the display automatically as the user physically rotates the device; support 0°, 90°, 180°, and 270°.
- Debounce with a stable-orientation interval and gravity threshold to avoid flipping while rolling dice or when the unit is nearly flat.
- Use `bsp_display_rotate()` only with the LVGL mutex held, and ensure the touch driver tracks rotation so buttons remain accurate in every orientation.
- Reflow control buttons and dice tray using the current display dimensions. Never reuse absolute landscape coordinates in portrait orientation.
- Preserve system lock, selected dice, generated face results, roll summary, and in-flight presentation state across orientation changes; do not reroll on rotation.
- Initial boot may use a temporary default orientation while the BMI270 initializes, but must settle into the physical device orientation.
- Test all four orientations on physical Tab5, including rotation during animation, touch accuracy, flat-device behavior, and repeated quick flips.
- If sensor initialization fails, log the problem clearly and keep a stable usable fallback orientation, not a continuously rotating UI.
- This requirement is **not satisfied by the first flashed test firmware**; do not label orientation support complete until the hardware tests pass.

## Large, recognizable tabletop dice visual tranche

- Each D&D die has a faceted silhouette with its own type and a large face value; no identical rounded-rectangle result tiles.
- Scale dice by visible count: single 230 px, two 200 px, 3–4 at 170 px, 5–8 at 136 px, 9–12 at 114 px, and larger pools at 104 px.
- The selection is immutable during a visual animation: label displays the RNG-generated face, not an animated substitute.
- Layout is computed from actual tray dimensions and centers short rows; additional rows scroll and never drop results.
- Draw ADV/DIS discarded dice with muted facets and an OUT label, without hiding either face.
- Use LVGL's draw-event triangle and line primitives; no per-die bitmap allocation or external image dependencies.
- Preserve orientation reflow, touch actions, result totals, clear/reset behavior and the existing guarded flash process.
- Device quality still requires real Tab5 verification of all four orientations, visual frame rate, and touch alignment.

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
- Top ~30%: tapping a die button adds to the pending pool; no dice are rolled until ROLL is tapped. ROLL throws the full selected pool once, and a later ROLL rerolls it.\n- ADV/DIS selects a mode for each d20 test in the pending pool. Each selected d20 gets a separate second d20; the chosen face is the higher/lower one. Other die types roll normally.\n- ADV/DIS never automatically selects/rolls an extra test, and the same mode button toggles that mode off.\n- CLEAR resets the pending pool, mode and visible results.
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
