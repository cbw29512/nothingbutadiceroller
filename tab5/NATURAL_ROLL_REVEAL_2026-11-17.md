# Tab5 natural d20 roll reveal — acceptance contract

## Objective

Remove the redundant CLEAR button; make selected natural 20 or natural 1
feel special after dice settle. Physical vibration is not supported by the
stock Tab5 hardware (no documented vibration motor). This tranche adds only
nonblocking on-screen feedback; optional speaker effects are separate work.

## State and data schema

- `dice_state_t` is unchanged: `pool`, `faces`, `second_faces`, `mode`,
  `count`, `has_result`, and `total` still own the actual outcome.
- `dice_visible_face_t` already marks whether a face is discarded due to
  advantage or disadvantage.
- `dice_nat_event_t`: NONE, NAT_20, NAT_1. The pure policy examines only
  retained visible d20 results. d4/d6/d8/d10/d12/d100 never trigger it.
- If several retained d20s include both 20 and 1, show NAT_20 first/only.
- Visual names CRITICAL HIT/MISS are thematic attack-roll labels; **no
  automatic success/failure is applied to checks or saving throws**.

## Lifecycle

- A dice button queues a new pool (and internally clears an old result).
  ROLL rerolls the current pool. ADV/DIS replace the pool with one d20 test
  and immediately roll two dice, keeping the higher/lower value.
- Show seven dice buttons plus ADV, DIS and ROLL. Keep the internal
  `dice_clear` helper; remove only the user-facing CLEAR button.
- Finish the normal 72-frame tumble; only then invoke the settled callback.
  Create a full-screen high-contrast reveal overlay without touching RNG,
  timer physics, dice outcomes or the footer.
- NAT20: gold highlight, giant 20, NATURAL 20!, CRITICAL HIT!
- NAT1: crimson highlight, giant 1, NATURAL 1!, CRITICAL MISS!
- Two deliberately slow visual pulses, no rapid strobe; overlay removes
  itself after 1.9 seconds and the settled dice remain visible beneath.
- On new accepted selection, reroll, session reset or LVGL timer failure,
  clean up the overlay and timer without leaving the screen blocked.
- Portrait/landscape: overlay uses 100% of its parent screen with centered
  text; ten controls use compact three-row portrait / two-row landscape.

## Gates

- Pure C test covers normal, non-d20, discarded ADV/DIS, equal d20 pairs,
  mixed d20 pools, missing results, invalid phase and no mutation.
- Portable JS contracts require result-before-animation, on-settle-only
  trigger, no RNG access in the effects module, and no CLEAR button.
- All prior native tests, portable JS tests, release validation, and an
  ESP-IDF 6.1 ESP32-P4 revision v1.3 build must pass.
- Do not flash before a hash-verified artifact exists. Flash application
  partition only with existing bootloader/partition layout. Recheck the
  guarded charger recovery and physical USB-to-battery handoff.
- Only on-device verification can certify actual screen effect readability.
