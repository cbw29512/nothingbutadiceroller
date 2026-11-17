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
  assert.match(power, /esp_io_expander_set_level\(io, CHARGE_ENABLE, 1\)/);
  assert.doesNotMatch(power, /IO_EXPANDER_PIN_NUM_4/);
  assert.doesNotMatch(power, /bsp_feature_enable\(BSP_FEATURE_USB/);
});

test("battery presence must be checked before enabling charging", () => {
  const power = source("tab5_power.c");
  assert.ok(power.indexOf("tab5_power_pack_present_mv(mv)") >= 0);
  assert.ok(power.indexOf("tab5_power_pack_present_mv(mv)") <
            power.indexOf("esp_io_expander_set_level(io, CHARGE_ENABLE, 1)"));
  assert.match(power, /INA226_BUS_VOLTAGE_REG 0x02/);
  assert.match(power, /BATTERY_INA226_ADDR 0x41/);
  assert.match(power, /i2c_master_bus_rm_device\(dev\)/);
});

test("charger is initialized after the shared I2C and before UI", () => {
  const main = source("main.c");
  assert.ok(main.indexOf("bsp_display_start()") <
            main.indexOf("tab5_power_init()"));
  assert.ok(main.indexOf("tab5_power_init()") <
            main.indexOf("dice_ui_start(&state)"));
  assert.doesNotMatch(main, /esp_restart\(\)/);
});
