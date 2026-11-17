# Tab5 battery-only shutdown: measurable diagnostics

## Reported behavior

Native ESP32-P4 dice app runs on USB power. Installed NP-F550 powered
the device prior to custom firmware work, but the device now blacks out
immediately on USB removal; the power button does not start it without
USB. The user repeated M5Stack's battery reset/reseat procedure, and
verified that PR #61 charging fix flashed with esptool hash verification.
The problem persists. A USB power meter read about 1 watt, which
does not measure battery charging current.

## New diagnostics: data/state

- INA226 bus voltage: I2C 0x41 register 0x02, unsigned 16-bit, 1.25mV/LSB.
- INA226 shunt voltage: register 0x01, signed 16-bit, 2.5uV/LSB.
- Report `BAT x.xxxV | SHUNT +/-NuV | CHG CMD ON/OFF` on-screen and serial.
- CHG CMD ON means **we successfully sent the output-enable
  command**. It does **not** prove the IP2326 is charging the pack.
- Read errors and shunt-read failures are reported distinctly.
- Poll every 15 seconds; do not write the charger expander during polls.
- Diagnostics do not affect RNG, combat/game data, memory card, or
  roller geometry.
- Route ESP-IDF logs to the ESP32-P4 USB Serial/JTAG COM port via
  `CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG=y`.
- The power widget is attached to all 3 app screens, and detached
  before screen children are deleted.
- Existing safety guard (plausible battery 4.0V to 8.8V) is unchanged
  pending actual voltage readings.

## User acceptance

1. Verify CI host tests, release validation, and native ESP32-P4 build.
2. Use prior proven application-only flash process on the correct COM
   port, after full 16 MB backup and partition/header checks.
3. Keep USB connected and read the **BAT** line on the screen or serial.
4. Note whether `CHG CMD` is ON or OFF. An OFF signal with a visible
   installed battery requires checking the I2C read/voltage gate.
5. Compare the BAT voltage and shunt reading after 15–30 minutes of
   continuous USB power; it may show recovery or lack of charging.
6. Only after voltage is plausible and stable, carefully test USB-only
   and battery-only operation with a charged pack.
7. If the battery does not charge, try a verified charged NP-F550
   battery or appropriate external NP-F charger to isolate pack vs
   device power path. Never bypass battery protection.

## Grounding

- https://docs.m5stack.com/en/core/Tab5
- https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-guides/stdio.html
- https://github.com/espressif/esp-bsp/tree/master/bsp/m5stack_tab5
