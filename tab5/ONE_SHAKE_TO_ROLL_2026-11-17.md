# Tab5: tap the dice, then shake once

## Definition of Done
- Tap D4–D100 buttons to queue a pool (e.g., D6 + D6).
- Give the tablet **one ordinary back-and-forth hand shake**.
- It must roll the **entire selected pool exactly once**, animate the
  same existing tray, and update the same footer as tapping ROLL.
- After cooldown, another single shake rerolls the same pool.
- No extra button, indicator, menu, overlay, or always-on sensor UI.
- Ordinary rotation, carrying it, and one accidental bump should not roll.
- The existing RNG, ADV/DIS controls, sounds, critical visuals, display
  rotation, battery charging/recovery and flash partition remain unchanged.

## Data schema and state
- `dice_state_t` is the authoritative selected pool, existing phase,
  faces, outcome and total. No alternate shake-specific dice state exists.
- `dice_shake_policy_t` tracks low-pass gravity, initial acceleration
  vector, initial impulse time, arming and cooldown timestamps.
- `imu_sample_t` is a small complete (x, y, z, monotonic_ms) accelerometer
  message delivered through a single-element FreeRTOS queue from the
  existing BMI270 callback to the orientation monitoring task.
- No extra sensor driver, new task, gyro fusion, or audio dependency.
- Each sample is processed for gesture detection at 40ms polling;
  auto-rotation still runs at approximately its previous 150ms cadence.

## Logic flow
1. After four calm sensor observations, arm the gesture.
2. Detect an acceleration distinct from slowly moving gravity (>=0.5g).
3. Look for a reverse-direction acceleration within 850ms.
4. Once the pair forms a single ordinary shake, disarm immediately.
5. Acquire the existing LVGL mutex and call `dice_ui_try_shake_roll()`.
6. The UI rejects the event when no dice are queued, an animation is
   running, or a critical screen is visible. Otherwise it calls the
   exact same secure `roll_start()` used by the ROLL button.
7. Do not trigger again for 1800ms and until calm observations rearm.
8. Report startup and detection outcomes through USB serial logs.

## Validation
- Pure C test: back-and-forth gesture, cooldown, a single bump,
  slow reversal, sensor noise, and near-still handling.
- Pure C integration: select D6 twice, shake, verify 2d6 and reroll
  the same 2d6 after the cooldown.
- JS source contract: only one BMI270 monitor, proper queue delivery,
  no new controls, no independent RNG, and the unchanged dice UI path.
- Firmware CI: ESP-IDF 6.1, ESP32-P4 revision 1.3 compatibility,
  original 1 MiB factory application partition size gate.
- Physical acceptance: no USB monitor required for use; try one
  comfortable shake after tapping a die. If not detected, capture
  the `orientation` serial log and calibrate the gesture threshold
  against real BMI270 readings rather than guessing.

## Note
Automatic CI tests prove logic and image compatibility, not how a
specific human hand shake reads on physical Tab5 hardware.
