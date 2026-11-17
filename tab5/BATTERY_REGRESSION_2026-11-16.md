# Tab5 battery regression: diagnosis and charging fix

## Objective

Restore normal NP-F550 battery charging in the native ESP32-P4 Tab5 dice roller.
This branch does **not** change dice rules, rolling visuals, display orientation,
bootloader, flash partitions, the Pocket DM app, or the microSD card.

## Verified hardware source

- IP2326 battery charger `CHG_EN`: PI4IOE5V6408 **second expander** (0x44) P7.
- Normal/quick charge choice `nCHG_QC_EN`: same expander P5, active LOW;
  drive HIGH to keep quick-charge disabled.
- Monitor: INA226 I2C address `0x41`, register `0x02` (pack bus voltage),
  1.25mV/LSB, MSB-first.
- `espressif/m5stack_tab5==1.3.3` offers `bsp_io_expander1_init()`,
  `bsp_i2c_get_handle()` and I/O expander pin controls. It does **not**
  expose the charge pin through `bsp_feature_enable()`.
- Expander GPIO outputs boot in high-impedance mode. Correct initialization
  needs OUTPUT direction, output level HIGH, then PUSH_PULL (clear high-Z).
- Official M5Stack docs: charging works only while powered on/initialized;
  packs below approximately 6V enter protection and may require the
  manufacturer's removal/reset/reinstall recovery sequence.

## State and data schema

- Existing `dice_state_t` is untouched.
- `tab5_power_init()` has one-time startup side effects, before dice UI.
- The INA226 register supplies a 16-bit unsigned sample -> integer millivolts.
- `tab5_power_pack_present_mv()` is a pure conservative check: the charger
  is enabled only if 4.0–8.8V appears at the battery bus. The absent-battery
  reference measurement is roughly 2V. Neither value is a cell health test.
- Pin P7 is charger-enable, P5 HIGH disables quick charge. We do not touch
  PWROFF_PULSE (P4), USB rail (P3), or Wi-Fi rail (P0).
- Serial logs report battery millivolts and charger-enable success/failure.
  No success claim is made without a successful I2C transaction.
- If INA226 cannot be read or voltage is implausible, charging remains off,
  and the dice app can continue on USB power.

## Logic flow

1. Start the BSP display (shared I2C bus initialization).
2. Read INA226 pack bus voltage at 0x41/0x02, decode 1.25mV/LSB.
3. If no plausible installed battery, **skip** charger enable and log.
4. Obtain cached BSP I/O expander 0x44; set P5 and P7 to outputs.
5. Drive P5 HIGH, push-pull (normal charge, not quick charge).
6. Drive P7 HIGH, push-pull (actual IP2326 charge enable).
7. Log result; continue ordinary dice initialization.
8. Compare voltage logs over time and physically test USB unplug only
   once a charged battery can operate.

## Testing and hardware limits

- Native CI must compile C with ESP-IDF 6.1, ESP32-P4 v1.3 compatibility.
- Host tests cover INA226 conversion, low voltage/absent pack, plausible
  2S pack, and implausibly high readings.
- This is a **charging initialization fix**, not proven hardware recovery:
  current charger state, battery health and charge current need on-device
  verification. A USB wattmeter shows total USB input, not pack current.
- If the pack is under its protection limit or the battery remains at
  impossible voltage, use M5Stack's official recovery procedure or an
  appropriate NP-F550 external charger; never bypass the protection.
- Do not attempt to pry open the pack or attach arbitrary voltage to the
  battery terminals. Stop if the pack swells, leaks or becomes hot.
