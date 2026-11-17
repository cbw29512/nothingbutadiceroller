# Tab5: dragon critical, physical dice audio and shake-to-roll

## Definition of done
Preserve the **existing ten-button layout** (D4/D6/D8/D10/D12/D20/D100,
ADV/DIS/ROLL), footer and dice tray. No persistent UI, menus, image packs,
microSD dependencies or cloud. Preserve native dice values, secure random
source, battery recovery, factory bootloader and 0x100000-byte app partition.

## Data schema and state logic
- Critical display reuses `dice_nat_event_t` and its retained d20 classifier.
  The new `dice_critical_art_t` adds only transient event/frame display state.
- `dice_motion_t.impacts` counts actual simulation wall/die collisions in
  the current frame, reset on every visual step. It never changes trajectories
  or any outcome, including ADV/DIS and percentile pairs.
- Audio reuses the existing single-worker ES8388 codec path. The queue has
  one cue; collisions are best-effort and never replace a pending NAT20/NAT1.
  A clack can play at most once per six animation frames; at frame 50 the
  dice settle into their home layout with a final soft landing noise.
- `dice_shake_policy_t` is a standalone, IMU-only 3-impulse policy with
  near-1g calm readings between impulses, 1.5s gesture window, five stable
  readings to rearm and 3s cooldown. No driver changes or independent sensor
  polling loop. The policy detects the physical gesture, not a result.
- The already-running orientation monitor passes BMI270 gravity readings
  to this policy. Its existing screen-rotation algorithm remains unchanged.
  Shake rolls only when the UI is in D&D session, at least one die is
  selected, no dice animation is in flight and no critical overlay is open.
  The UI then calls the exact same `roll_start()` as the ROLL button.

## Render and playback
- Selected NAT20: existing gold reveal and trumpet now include a procedural
  angular dragon head breathing animated fire. Selected NAT1: existing
  crimson reveal and boo now include a cracked d20 and flying fragments.
- The artwork is composed of LVGL line/triangle primitives on the existing
  temporary overlay. It allocates no bitmap and lasts only for that overlay.
- Each physical impact produces a bounded short original synthesized
  resin/wood clack. A short low landing thump accompanies the move into
  the final grid. Voice/audio codec startup remains lazy and off between cues.
- These are **presentation effects**, not engine-critical modifiers.
  No automatic success/failure is added for ability checks or saving throws.

## Validation gates
- Host: deterministic three-shake tests with holding, cooldown, false
  positives, accidental tilts, time-window expiry; PCM max-peak tests;
  physics frame contacts and unchanged positions; all existing native tests.
- JS: source contracts for no extra controls, explicit link to old roll
  path, on-settle effects, nonblocking best-effort sound, original charging.
- ESP-IDF 6.1 full firmware and compatibility checks for ESP32-P4 revision
  v1.3. The application must fit the **existing 1 MiB partition**, without
  modifying bootloader or partition table.
- On-device: verify that normal tilting, picking up or rotating the Tab5
  never rerolls; deliberate three-pulse shake rerolls once; another shake
  during animation does nothing; touching the normal buttons still works;
  NAT20/NAT1 visuals and sound stay synchronized; no overheating, distorted
  audio, or USB-to-battery regression.

## Limits
- No direct Tab5 hardware audio/IMU/graphics acceptance was performed here.
  The synthetic clatter and vector dragon are low-memory approximations,
  not a studio-quality animation or sampled dice sound.

## Critical-screen revision after on-device feedback

The procedural dragon and shattered die looked poor on the actual Tab5.
They are **removed**. The proposed abstract shockwave was superseded
before release by the user's explicit direction: **large flashing 20/1
with separate background colors and playful text**.

- NAT20: giant gold **20**, top label NATURAL 20!, bottom HELL YEAH!,
  background alternates warm golden-yellow with deep amber-black.
- NAT1: giant red **1**, top label NATURAL 1!, bottom OH NO!,
  background alternates crimson with dark red-black.
- Two restrained pulses in the existing 1.9-second overlay. The number
  itself scales between 3.5x and 4x the existing 48pt LVGL font, without
  compiling a new large font or adding graphics assets.
- No skull/dragon/die illustrations or expensive polygon renderer; keep
  it bold and legible even in portrait.
- No added controls, menus, font assets, bitmap files, data, or persistent
  objects. The existing trumpet, boo, collision sounds, shake-to-roll,
  secure dice RNG, and battery path are unchanged.
- Final legibility and aesthetics still need a physical Tab5 test.
