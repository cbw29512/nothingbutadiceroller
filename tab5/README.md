# Tab5 Universal Dice Console — firmware foundation

Status: **design + portable rules-engine prototype**, not flashed onto the Tab5.

## Definition of Done (V1)

- Boot shows game-system selection; after confirmation, system stays locked until reboot.
- No Back/Home/system-switch control while a session is active.
- Top ~30% of the 1280×720 display contains large game-specific touch controls.
- Bottom ~70% displays animated individual dice, visible faces, results, and a persistent total.
- Every die is inspectable, including large pools; scrolling may be needed, but never silently truncate results.
- Offline-only operation; no cloud, phone, Netlify or Wi-Fi requirement.
- Native ESP32-P4 implementation uses a verified CSPRNG/entropy source and unbiased rejection sampling.
- Standard and custom dice use the same secure numerical engine; animation only visualizes results.
- Each game profile defines die faces, face values, roll modifiers, success interpretation and quick actions.
- Persistent settings, favorites, and history must be explicitly designed before implementation.
- Device wiping/flashing happens only after firmware and backups have been verified.

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
