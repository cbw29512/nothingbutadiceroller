import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  try {
    return readFileSync(new URL("./native/main/" + path, import.meta.url), "utf8");
  } catch (error) {
    console.error("Tab5 power policy contract source unavailable", path, error);
    throw error;
  }
}

test("charge-enable uses the verified second expander pin without poweroff", () => {
  const power = source("tab5_power.c");
  assert.match(power, /#define CHARGE_ENABLE IO_EXPANDER_PIN_NUM_7/);
  assert.match(power, /#define QUICK_CHARGE_DISABLE IO_EXPANDER_PIN_NUM_5/);
  assert.match(power, /bsp_io_expander1_init\(\)/);
  assert.match(power, /IO_EXPANDER_OUTPUT_MODE_PUSH_PULL/);
  assert.match(power, /esp_io_expander_set_level\(io, CHARGE_ENABLE, enable \? 1 : 0\)/);
  assert.doesNotMatch(power, /IO_EXPANDER_PIN_NUM_4/);
  assert.doesNotMatch(power, /bsp_feature_enable\(BSP_FEATURE_USB/);
});

test("boot gate remains, manual recovery uses bounded separate policy", () => {
  const power = source("tab5_power.c");
  const recovery = source("tab5_power_recovery.c");
  const boot = power.slice(power.indexOf("bool tab5_power_init(void)"));
  assert.match(boot, /tab5_power_pack_present_mv\(mv\)/);
  assert.match(boot, /return tab5_power_command_set\(true\);/);
  assert.match(power, /INA226_BUS_VOLTAGE_REG 0x02/);
  assert.match(power, /BATTERY_INA226_ADDR 0x41/);
  assert.match(power, /i2c_master_bus_rm_device\(dev\)/);
  assert.match(recovery, /tab5_power_command_set\(true\)/);
  assert.match(recovery, /tab5_power_command_set\(false\)/);
  assert.match(recovery, /TAB5_RECOVERY_SETTLE_MS/);
  assert.match(recovery, /tab5_recovery_pack_visible_with_charger_off/);
  assert.doesNotMatch(recovery, /IO_EXPANDER_PIN_NUM_4/);
});

test("charger is initialized after the shared I2C and before UI", () => {
  const main = source("main.c");
  assert.ok(main.indexOf("bsp_display_start()") <
            main.indexOf("tab5_power_init()"));
  assert.ok(main.indexOf("tab5_power_init()") <
            main.indexOf("dice_ui_start(&state)"));
  assert.doesNotMatch(main, /esp_restart\(\)/);
});
