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

## Confirmed recovery on the physical Tab5 (2026-11-17)

- **Firmware:** PR #63 (`09cea60546e0377b9d23d3594dc7d277d739846c`)
  was hash-verified and flashed on the user's ESP32-P4 revision v1.3.
- **Before recovery:** the diagnostic firmware showed about **BAT 1.014V**,
  **SHUNT +0uV**, **CHG CMD OFF**. With USB removed the Tab5 went dark.
- **Successful user action:** the user pressed the new on-screen battery
  recovery control. They reported **"pushing the button fixed it. Batt 7V
  chg cmd on"**. This demonstrates that the recovery action raised the
  *measured battery bus voltage* to approximately 7 V and enabled the
  charger command.
- **USB-unplug verification passed:** user then unplugged USB-C and reported
  **"i unplugged it nd it stayed on!"**. This confirms live battery-only
  operation and USB-to-battery handoff on the actual Tab5.
- **Not yet verified:** independent battery-pack voltage, measured charging
  current, full charge, unplugged cold-boot, or extended battery endurance.
  Do not claim those tests passed until observed.
- **Regression lesson:** never replace battery recovery with a startup-only
  voltage gate, delete the recovery UI to simplify dice controls, or
  reconfigure the second expander from unrelated new features.
- **Must keep:** factory P4 LOW at startup, P7 charger control, P5 normal
  charge mode, 30-second two-tap supervised recovery, I²C INA226 voltage
  diagnostics, charger-OFF presence check, correct 8.45 V ceiling and error
  fail-off path.
- **Before each future hardware firmware release:** run the C/Node
  power-contract tests and ESP32-P4 build; then physically check battery
  voltage, charge command, and USB-disconnect operation. Keep a verified
  full-flash backup and unchanged partition layout.

## Verified Tab5 source / wiring

- Official M5Stack Tab5 factory C code:
  `m5stack/M5Tab5-UserDemo`,
  `platforms/tab5/components/m5stack_tab5/m5stack_tab5.c`.
- Second PI4IOE5V6408, I2C `0x44`:
  - P7 (active-high `CHG_EN`) enables IP2326 charger.
  - P5 (active-low `nCHG_QC_EN`) controls quick charging;
    P5 HIGH uses normal/low charging path.
  - P4 power-off pulse is restored to its verified factory idle
    state: output LOW (never pulse HIGH). The native BSP had left it
    unconfigured/high-impedance; this may affect battery-only power
    retention, but physical effect is not yet verified.
  - P3 USB rail and P0 wireless remain untouched.
- INA226 I2C `0x41` register `0x02`: battery bus
  1.25mV/LSB. A charger-on reading can be a false indication that a
  battery is fitted. Verify with the charger **off** and settled.
- M5Stack documents reduced-current charger recovery for an
  under-protection battery and warns that charging initialization only
  occurs when the device is on.
- Real-world Tab5 ESPHome project implements a short manual,
  user-declared battery-present recovery pulse and safe charger-off probe:
  https://axellum.github.io/M5-Tab5-ESPHome-LVGL/en/tab5-battery/

## Post-repair UI cleanup

- User requested removal of the temporary battery-testing readout once
  USB-disconnect worked. Keep battery sensors, log output, charger
  initialization, and manual recovery state machine installed.
- During healthy normal play (5.5–8.45V, charge command ON, normal/complete
  recovery phase), hide the BAT/SHUNT/CHG CMD readout and recovery status
  controls to restore the full dice interface.
- If battery detection fails, recovery is active, or a recovery error occurs,
  display the diagnostic reading and relevant recovery control automatically.
- Do **not** remove the recovery mechanism, delete fault logs, or turn
  battery-only success into a claim of measured charging current.

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
