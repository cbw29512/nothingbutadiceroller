import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    console.error("Battery diagnostic contract missing", path, error);
    throw error;
  }
}

test("route ESP-IDF logs to the Tab5 USB Serial/JTAG COM port", () => {
  const config = read("./native/sdkconfig.defaults");
  assert.match(config, /^CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG=y$/m);
});

test("battery diagnostic reads INA226 voltage and signed shunt", () => {
  const diag = read("./native/main/tab5_power_diag.c");
  assert.match(diag, /#define INA226_ADDRESS 0x41/);
  assert.match(diag, /#define INA226_SHUNT_VOLTAGE 0x01/);
  assert.match(diag, /#define INA226_BUS_VOLTAGE 0x02/);
  assert.match(diag, /tab5_power_decode_ina226_shunt_uv/);
  assert.match(diag, /CHG CMD/);
  assert.doesNotMatch(diag, /esp_io_expander_set_(level|dir)/);
});

test("battery reading is visible and refreshed without changing dice state", () => {
  const widget = read("./native/main/tab5_power_widget.c");
  const ui = read("./native/main/dice_ui.c");
  assert.match(widget, /lv_timer_create\(refresh, 15000, NULL\)/);
  assert.match(widget, /tab5_power_diag_format/);
  assert.match(ui, /tab5_power_widget_detach\(\)/);
  assert.equal((ui.match(/tab5_power_widget_attach\(g_screen\)/g) ?? []).length, 3);
  assert.ok(ui.indexOf("tab5_power_widget_detach();") <
            ui.indexOf("lv_obj_clean(g_screen);"));
});

test("prior safety gate and charging controls are unchanged", () => {
  const power = read("./native/main/tab5_power.c");
  assert.match(power, /tab5_power_pack_present_mv\(mv\)/);
  assert.match(power, /#define CHARGE_ENABLE IO_EXPANDER_PIN_NUM_7/);
  assert.match(power, /#define QUICK_CHARGE_DISABLE IO_EXPANDER_PIN_NUM_5/);
  assert.match(power, /g_charge_command_enabled = true/);
  assert.doesNotMatch(power, /IO_EXPANDER_PIN_NUM_4/);
});
