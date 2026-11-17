import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  try {
    return readFileSync(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    console.error("Tab5 recovery contract source unavailable:", path, error);
    throw error;
  }
}

test("recovery requires explicit two-step touch confirmation", () => {
  const ui = read("./native/main/tab5_power_widget.c");
  assert.match(ui, /if \(!g_confirm_pending\)/);
  assert.match(ui, /g_confirm_pending = true;/);
  assert.match(ui, /CONFIRM BATTERY FITTED/);
  assert.match(ui, /tab5_power_recovery_begin\(now_ms\(\)\)/);
  assert.match(ui, /tab5_power_recovery_cancel\(\)/);
});

test("charger cannot be left on after an unsuccessful recovery", () => {
  const recovery = read("./native/main/tab5_power_recovery.c");
  const policy = read("./native/main/tab5_recovery_policy.c");
  assert.match(recovery, /g_phase != TAB5_RECOVERY_READY/);
  assert.match(recovery, /tab5_power_command_set\(false\)/);
  assert.match(recovery, /TAB5_RECOVERY_PROBE_MS/);
  assert.match(recovery, /TAB5_RECOVERY_SETTLE_MS/);
  assert.match(recovery, /tab5_recovery_pack_visible_with_charger_off/);
  assert.match(recovery, /TAB5_RECOVERY_NO_PACK/);
  assert.match(policy, /mv <= 8450/);
  assert.match(policy, /mv >= 5500/);
  assert.doesNotMatch(recovery, /vTaskDelay/);
});

test("normal charger is not enabled at boot when pack is unverified", () => {
  const power = read("./native/main/tab5_power.c");
  const main = read("./native/main/main.c");
  assert.match(power, /if \(!tab5_power_pack_present_mv\(mv\)\)/);
  assert.match(power, /return tab5_power_command_set\(true\)/);
  assert.doesNotMatch(main, /tab5_power_recovery_begin/);
});

test("recovery UI remains in the battery widget only", () => {
  const ui = read("./native/main/tab5_power_widget.c");
  assert.match(ui, /lv_obj_add_event_cb\(g_button, recovery_tap/);
  assert.match(ui, /lv_timer_set_period\(g_timer, desired_period\)/);
  assert.match(ui, /g_label = NULL;/);
  assert.match(ui, /if \(!g_label\) return;/);
  assert.match(ui, /tab5_power_recovery_poll\(&reading, now\)/);
});
