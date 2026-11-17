# Tab5 NP-F550 known-good battery / native firmware recovery

## Objective and observed data

- User confirms the battery was working before our firmware changes, is
  seated correctly, and the M5Stack battery reset sequence has already
  been repeated multiple times.
- Our dice app boots on USB-C, but blacks out instantly unplugged.
- Diagnostic firmware built and installed correctly (PR #62).
- Battery monitor reads about **1.014 V**, signed shunt near **0 uV**,
  charger command **OFF**.
- PR #61 had a firmware gate requiring **at least 4.0 V** for charger
  enable. It therefore leaves charging disabled indefinitely at 1.014 V,
  even if a known-good battery's protection circuit disconnected its output.
- The 1.014 V bus measurement does **not** prove the physical battery
  pack is at 1.014 V. An empty bay, disconnected pack or protected pack
  can also produce a low reading.

## Verified Tab5 source / wiring

- Official M5Stack Tab5 factory C code:
  `m5stack/M5Tab5-UserDemo`,
  `platforms/tab5/components/m5stack_tab5/m5stack_tab5.c`.
- Second PI4IOE5V6408, I2C `0x44`:
  - P7 (active-high `CHG_EN`) enables IP2326 charger.
  - P5 (active-low `nCHG_QC_EN`) controls quick charging;
    P5 HIGH uses normal/low charging path.
  - P4 power-off pulse, P3 USB rail, P0 wireless **untouched**.
- INA226 I2C `0x41` register `0x02`: battery bus
  1.25mV/LSB. A charger-on reading can be a false indication that a
  battery is fitted. Verify with the charger **off** and settled.
- M5Stack documents reduced-current charger recovery for an
  under-protection battery and warns that charging initialization only
  occurs when the device is on.
- Real-world Tab5 ESPHome project implements a short manual,
  user-declared battery-present recovery pulse and safe charger-off probe:
  https://axellum.github.io/M5-Tab5-ESPHome-LVGL/en/tab5-battery/

## Schema / lifecycle

- Existing `dice_state_t` and gameplay logic remain unchanged.
- `tab5_recovery_phase_t`: READY, PROBING, VERIFY_OFF,
  CHARGING, NO_PACK, ERROR, CANCELLED.
- The visible battery widget offers `RECOVER BATTERY (30s)`
  only when the charger command is OFF.
- First tap changes the control to `CONFIRM BATTERY FITTED`.
  Second tap is explicit physical-presence confirmation; it turns
  normal-rate charging ON.
- The recovery probe runs for **no longer than 30 seconds**,
  samples INA226 about once per second, and aborts on sensor error or
  measured battery bus exceeding 8.45V.
- Then charger is commanded OFF, allow 2 seconds to settle.
  Only a charger-OFF reading of **5.5V–8.45V** can authorize
  continuous normal charging.
- If pack voltage remains too low, OFF command is issued, a failure
  is visible, and another recovery attempt is refused until reboot.
- Tap STOP any time during the probe/verification to cancel.
- No unattended automatic recovery and no disabled battery safeguards.
- The UI timer continues the safety checks if no view is attached.
- Existing dice geometry, dice state, bootloader, flash partitions,
  microSD and firmware updater are unchanged.

## Tests

- Host C checks exact 30s / 2s time bounds and independent charger-off
  voltage predicate.
- Node contract checks two-stage manual confirmation, reuse of P7/P5,
  and absence of unsafe unguarded startup writes.
- ESP-IDF 6.1 build is required for ESP32-P4 v1.3, with
  SHA-256 firmware artifact.
- Physical acceptance requires reading the BAT/SHUNT/CHG CMD text on the
  real Tab5 **during** and **after** a recovery attempt while on USB.
- If charger-OFF voltage remains ~1V despite a known-good battery,
  this is an electrical path/battery-contact/protection observation
  that software cannot conclusively resolve.

Do not apply voltage directly to battery terminals or bypass BMS protection.
