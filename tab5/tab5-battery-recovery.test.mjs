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

test("factory power-off pulse is held LOW, never pulsed HIGH", () => {
  const board = read("./native/main/tab5_board_power.c");
  const main = read("./native/main/main.c");
  assert.match(board, /POWER_OFF_PULSE IO_EXPANDER_PIN_NUM_4/);
  assert.match(board, /esp_io_expander_set_level\(io, POWER_OFF_PULSE, 0\)/);
  assert.match(board, /IO_EXPANDER_OUTPUT_MODE_PUSH_PULL/);
  assert.doesNotMatch(board, /esp_io_expander_set_level\(io, POWER_OFF_PULSE, 1\)/);
  assert.ok(main.indexOf("tab5_board_poweroff_idle_init()") <
            main.indexOf("tab5_power_init()"));
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

test("hardware-verified recovery remains a permanent future-feature contract", () => {
  const readme = read("./README.md");
  const recovery = read("./BATTERY_RECOVERY_2026-11-17.md");
  const main = read("./native/main/main.c");

  assert.match(readme, /Battery power — mandatory non-regression contract/);
  assert.match(readme, /PR #63/);
  assert.match(readme, /about 7 V with CHG CMD ON/);
  assert.match(readme, /confirmed USB-to-battery handoff/);
  assert.match(readme, /preserve the fault-visible BAT\/SHUNT\/CHG CMD diagnostics/i);

  assert.match(recovery, /Confirmed recovery on the physical Tab5/);
  assert.match(recovery, /pushing the button fixed it/);
  assert.match(recovery, /Not yet verified:/);
  assert.match(recovery, /Before each future hardware firmware release/);

  assert.match(main, /tab5_board_poweroff_idle_init\(\)/);
  assert.match(main, /tab5_power_init\(\)/);
  assert.match(main, /dice_ui_start\(&state\)/);
});
