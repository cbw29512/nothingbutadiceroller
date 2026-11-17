# Tab5 Universal Dice Console — firmware foundation

Status: **initial native ESP32-P4 v1.x dice firmware and large polyhedral visual prototype**. Native and host tests are required before any on-device verification. The current motion is source-independent 2D contact simulation with individual rebounds, spin and soft landing; this is **not** certified 3D rigid-body physics.

## Battery power — mandatory non-regression contract (physically observed 2026-11-17)

**Never remove or bypass the Tab5 battery/power initialization when adding dice,
sound, UI, recorder, wireless or other features.** See
[`BATTERY_RECOVERY_2026-11-17.md`](BATTERY_RECOVERY_2026-11-17.md)
for the verified pin map, state transitions, source evidence and recovery steps.

- A custom firmware build previously left a known-good NP-F550 unable to run
  the Tab5 without USB; INA226 displayed **1.014 V, shunt near 0 µV, CHG CMD OFF**.
  Our 4.0 V charger gate prevented battery-recovery charging.
- The corrected **PR #63** firmware was installed on **2026-11-17**. The
  user tapped the two-step on-screen recovery control and reported that this
  **restored the battery bus to about 7 V with CHG CMD ON**. This is confirmed
  hardware feedback, **not yet confirmation of USB-unplug operation or measured
  battery charging current**.
- Preserve startup order: display/shared I²C initialization, factory
  power-off pulse idle **P4 LOW**, then safe charger initialization, then UI.
  Preserve INA226 readings at I²C `0x41` and IP2326 control on the **second**
  expander `0x44`: P7 = CHG_EN HIGH, P5 = disable quick-charge HIGH.
- Do not reset or overwrite those expander outputs from later modules. Do
  not pulse P4 HIGH except for an explicitly designed and independently
  reviewed power-off operation.
- Preserve the visible BAT/SHUNT/CHG CMD diagnostics and the guarded,
  user-confirmed 30-second recovery control. No unprompted charging of an
  unverified pack, no removal of the charger-off presence check, no
  bypass of the 8.45 V safety ceiling. CHG CMD ON is not measured current.
- Every Tab5 firmware change must run the native host/Node contracts,
  ESP32-P4 v1.3 firmware build, and an actual USB-to-battery power
  handoff test before describing battery-only operation as verified.
  Flash application-only with a verified backup/partition table.

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
- Draw ADV/DIS discarded dice with muted facets and no text overlay, without hiding either face.
- Use LVGL's draw-event triangle and line primitives; no per-die bitmap allocation or external image dependencies.
- Preserve orientation reflow, touch actions, result totals, clear/reset behavior and the existing guarded flash process.
- Device quality still requires real Tab5 verification of all four orientations, visual frame rate, and touch alignment.

## Physical d100 and ADV/DIS display policy
- Each logical d100 produces **two separate full-size d10 visual widgets**, one for tens and one for units, instead of splitting one tiny die tile.
- Only one unbiased game roll from 1–100 is generated. The visual digits are derived from that same result, with 00+0 representing 100.
- Up to 32 logical d100 rolls create 64 independent physical dice, with scrollable overflow.
- ADV/DIS discarded dice are identified by muted facets only. No OUT text overlay or redundant die-type text.

## Die face cleanup
- The original UI's `d4/d6/d8/d10/d12/d20/d100` captions no longer float across polyhedron faces. Dice shape and engraved values carry identity.
- ADV/DIS discarded dice remain muted, without any floating `OUT` or die-type labels; face values, results and footer totals stay unchanged.

## Authentic shapes and numbered faces — geometry audit
- d4 is a tetrahedron, d6 a cube, d8 an octahedron, d10 a mathematically planar pentagonal trapezohedron, d12 a dodecahedron, and d20 an icosahedron.
- For d100, show **two separate full-size actual d10 solids**: one with percentile tens (00, 10, ..., 90) and one with units (0–9). The combination 00+0 is interpreted as 100, without modifying the secure roll or its total.
- For 1–8 visible dice, mesh face numbers are drawn onto projected polygons and fixed to the RNG result before animation. The chosen value appears on the front-facing face when settled; the floating duplicate number is hidden. Large pools use cheap silhouettes while moving, then show authentic numbered solids when settled. This remains **presentation only**, not a new RNG or rules engine.
- Host certification checks every mesh edge is shared exactly twice, all polygon vertices lie in a plane, Euler topology is closed, each settled number matches the secure result, and all 100 percentile values map correctly.
- Face assignments preserve distinct values but are not yet certified against the manufacturing face-number adjacency pattern of a particular commercial dice set.
- **Do not flash until firmware CI passes and the real Tab5 image has been verified.** The stand orientation and user-confirmed ADV/DIS behavior remain unchanged.

## Website DiceBox visual-parity experiment
- Web uses pinned DiceBox 1.1.4 with Ammo WASM and a browser 3D renderer; the ESP32-P4 native Tab5 does not run that module or provide equivalent WebGL acceleration.
- Offline native experiment: actual polyhedron meshes for d4, d6, d8, d10, d12, d20 and percentile d10 presentation; three-axis rotation, back-face culling, perspective and directional facet shading on the existing LVGL draw layer.
- Each source-verified die result is generated by the existing engine before animation. Rolling shapes never rewrite its outcome. After settling, the final game face is displayed as an overlay for accuracy; textured face numbers mapped to physical geometry remain separate work.
- Mesh animation is limited to 1–8 visible dice to protect frame rate and RAM. Large pools retain lightweight silhouettes with all faces/results inspectable. This is a 3D-style visualization, **not** actual website DiceBox physics, and must not be certified as visual parity until frame-rate, hardware orientation and touch tests pass.
- No Wi-Fi, cloud, microSD writes or website feature changes are introduced.

## Physics presentation contract (V1)

- After pressing Roll, individual dice tumble, translate, spin, bounce off tray boundaries and collide with other dice until they settle.
- Use a real time-step-based collision/physics simulation, not a canned GIF or a series of arbitrary result screens.
- The unbiased secure RNG fixes each die's actual game face; simulation influences only presentation and must never overwrite a rolled face.
- Support authentic standard polyhedral shapes and system-specific marked faces; implementation may use optimized 3D meshes, with measured ESP32-P4 frame rates.
- Sound is tied to actual simulated contacts, with a limiter to avoid loud multi-die rolls.
- Large pools may reduce rendering detail for performance, but every die and raw result remains inspectable.
- Verify native display acceleration, LVGL and frame-buffer performance before choosing the 3D rendering implementation. Do not assume browser DiceBox is portable to ESP32-P4.
- Phase 2 (not V1): saved spell and attack shortcuts, e.g. Fireball 8d6. No shortcuts or customization UI in the initial firmware.

## Stand orientation and rolling quality (review build)
 
- When upright on a stand, six consistent gravity observations (~900 ms) are required before auto-rotation. Flat/diagonal readings and momentary vibration keep the last readable angle.
- The current Tab5 IMU-to-display orientation mapping is retained; confirm actual physical upright text and touch in all four directions before release.
- Die animation gets separate per-die initial impulses, wall reflections, contact response and angular spin. A soft ease-in places settled numbers into the existing non-overlapping grid.
- The immutable secure dice result is computed before motion. Its numeric face is hidden until animation settles. Large pools skip the expensive rotating-widget transform.
- This is an improved 2D visual simulation, **not** final 3D mesh collision or audio. Hardware quality, frame rate, stand angle, touch and performance need on-device acceptance.
 
## V1 interaction contract

- Power on → choose a supported game → confirm → session-locked dice screen.
- Die buttons queue dice without rolling. ROLL throws that entire pool once; another ROLL clears the previous result and rerolls the same pool.
- ADV and DIS are instant **single-check** shortcuts. One tap replaces any pending or completed selection with one d20 check, rolls exactly two d20s once, and selects the higher (ADV) or lower (DIS) face.
- Repeated ADV/DIS taps reroll a fresh single check. They never stack, toggle off, or add another pair. A subsequent ROLL rerolls the last single check with its active ADV/DIS mode.
- A die button pressed after a completed result starts a new normal pool. CLEAR resets pool, total, mode, and visible results.
- Invalid die requests preserve the existing result. A quick ADV/DIS replaces even a full pending pool.
- The bottom summary clearly displays selected dice quantity, roll mode, and result total using an enlarged 36 px typeface; the footer is reserved in portrait and landscape.
- Bottom tray displays individual rolled faces with visibly muted discarded dice for ADV/DIS, with scrolling for large pools; it must never silently drop dice.
- Buttons and dice rendering change with the selected game system. No customization menu or system switch during play.
- Only source-verified game profiles are supported; custom user dice are deferred.

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
