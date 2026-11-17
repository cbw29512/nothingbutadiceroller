# Tab5 Dice Firmware — Full Native Code Audit (2026-11-16)

## Objective and scope

Audit the complete **native ESP32-P4 Tab5 dice application**, including gameplay,
layout, live polygon rendering, motion, device orientation, component dependencies
and automated tests. Fix two observed hardware defects: tiny d100 halves and
unwanted OUT text. The website, Pocket DM, bootloader and microSD are out of
scope. A source/build audit cannot substitute for a physical-device test.

## Data schema and state flow

- `dice_state_t`: session phase, locked system, up to 32 logical dice, secure
  1..N faces, optional d20 ADV/DIS secondary face, total and modifiers.
- `dice_visible_face_t`: maps one logical result to **one or two physical
  widgets**, preserving source index and original face. A d100 has a tens d10
  followed by a units d10; it remains exactly one game RNG draw.
- `dice_layout_t` and `dice_motion_t`: size, positions, scroll rows and
  bounded display-only trajectories for up to 64 visual objects.
- `die_shape_state_t`: one source die, one persistent polygon face-label
  table and its presentation angles per LVGL object. LVGL deletion frees slot.
- `orientation_policy_t`: orientation candidate, current stable angle and
  six-sample debounce; no game rules or face values involved.

Flow: UI chooses pool -> unbiased RNG resolves each game die once ->
result view expands d100/d20 ADV pairs -> layout allocates full-sized objects ->
motion runs independently -> final geometry prints the source-correct values.
Rotation reflows objects and face label sizes without rerolling.

## Audit inventory / results

| Area | Checked | Outcome |
|---|---|---|
| Dice engine / secure RNG | Valid dice, rejection sampling, partial roll protection, ADV/DIS | Bounds and die-kind prevalidation added; P4 v6.1 entropy behavior checked against Espressif |
| Controls / locked session | D&D choice, one-tap ADV/DIS, standard pools, CLEAR/ROLL | No game-rule change |
| Result mapping | d100 composite split, multi-d100, mixed pools, ADV/DIS | Now renders two distinct full-sized d10 objects per d100 |
| Dice visual widgets | Type labels, face labels, discard appearance | OUT overlay removed; discard is grey facets only |
| Mesh / projection | d4/d6/d8/d10/d12/d20/d100, closure, coplanarity, face numbers | Existing mesh/geometry tests retained; percentiles painted on physical d10 polygons |
| Layout / maximum pools | 2, 4, 32 and 64 physical objects, portrait and landscape | New stress tests verify full-size two-die d100 and no-overlap 64-die layout |
| Motion / display state | Frame cap, walls, collisions, rotation while moving | Motion never generates or changes game result; max 64 dice tested |
| Device orientation | BMI270 poll, 900ms debounce, LVGL mutex, reflow | Face label font/pivot now updated on reflow |
| LVGL allocation / failures | Screen, buttons, dice tray and shape table | Critical null checks added; failed shape creation returns a logged error |
| Build configuration | ESP32-P4 v1.x, 16 MB, CMake, assets, firmware offsets | CI must pass ESP-IDF 6.1 and v1.3 image-info gate before flash |

## Findings fixed

1. **UI / high:** d100 displayed both dice in one square and halved each
   polygon. Each logical d100 now creates two independent physical dice,
   using normal layout sizing, physics and scroll behavior.
2. **UI / medium:** discarded ADV/DIS dice had floating `OUT` text. The text
   is gone; the discarded die remains muted.
3. **Safety / high:** `dice_roll()` did not reject a corrupt count greater
   than `DICE_MAX`, unsupported sides or invalid mode before invoking RNG.
   It now fails closed without consuming RNG or changing committed results.
4. **Usability / medium:** after rotating the Tab5, face-label fonts and
   pivots could retain stale sizes. Resize now updates both.
5. **Robustness / medium:** missing LVGL controls/tray or shape registration
   could leave broken widgets or lead to null dereferences. Critical guards
   and meaningful logs have been added.

## Regression requirements (source + build)

- The engine still resolves one logical d100 with one unbiased draw;
  `100 -> (00, 0)`, `56 -> (50, 6)`, ADV/DIS still executes two d20s.
- One d100 must have two visible objects; 32d100 must have exactly 64
  objects. Neither pool total nor game die count doubles.
- Every visible percentile die uses the same square die size as other
  dice in that visual pool, not half-sized children.
- No LVGL `OUT` or floating die-type labels.
- Tests cover invalid dice, invalid state count/mode, out-of-range indexes,
  geometry, multi-dice interactions, deterministic visual motion and reflow.
- GitHub native host tests, JS contract tests, full ESP-IDF firmware build,
  revision-v1.3 compatibility and packaged SHA-256 must pass.

## Remaining risks / deferred (not certified here)

- **Hardware acceptance:** test all die sizes, 1d100/2d100/32d100,
  touch accuracy and readability, the stand, portrait/landscape, and
  live refresh rate on physical Tab5.
- **Performance:** approximate 2D contact resolution is O(n²) per frame;
  high pool frame rate has not been measured on the device. Physics parity
  with browser DiceBox and real rigid-body 3D physics are not claimed.
- **Orientation:** sensor callback uses volatile cross-task readings.
  A coherent snapshot or shared lock would be preferable if hardware
  testing reveals jitter; the existing 6-sample policy stays unchanged.
- **Face adjacency:** non-front side numbering is not certified to a
  manufacturer's face adjacency arrangement; values stay distinct.
- **Feature scope:** bounded history and additional game profiles appear
  in the V1 specification but are not demonstrated by this firmware.
  No claim of implementing them is made.
- **RNG:** native P4 entropy is documented for ESP-IDF v6.1, but a statistical
  or on-hardware entropy test was not performed here.

No microSD changes or device flashes were made as part of this audit.
