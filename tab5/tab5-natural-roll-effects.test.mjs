import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(name) {
  try {
    return readFileSync(new URL("./native/main/" + name, import.meta.url), "utf8");
  } catch (error) {
    console.error("Tab5 NAT effect source missing:", name, error);
    throw error;
  }
}
test("CLEAR disappears from the ten-button UI without removing state resets", () => {
  const ui = source("dice_ui.c");
  const layout = source("dice_ui_layout.c");
  const controls = source("dice_controls.c");
  assert.match(ui, /g_controls\[10\]/);
  assert.match(ui, /"ADV", "DIS", "ROLL"/);
  assert.doesNotMatch(ui, /"CLEAR"/);
  assert.match(layout, /controls\[10\]/);
  assert.match(layout, /i < 10/);
  assert.match(layout, /button_width = \(usable - gap\) \/ 2/);
  assert.match(controls, /dice_clear\(state\)/);
});
test("NAT spectacle starts only after dice have visibly settled", () => {
  const tray = source("dice_tray.c");
  const ui = source("dice_ui.c");
  const fx = source("dice_nat_fx.c");
  assert.match(tray, /const bool moving = dice_motion_step\(&motion\)/);
  assert.match(tray, /if \(on_settled\) on_settled\(\)/);
  assert.match(ui, /dice_tray_set_settled_callback\(on_roll_settled\)/);
  assert.match(ui, /dice_nat_fx_show\(g_screen, dice_nat_event_detect\(g_state\)\)/);
  assert.match(fx, /frame >= 19/);
  assert.match(fx, /frame >= 1 && frame <= 2/);
  assert.match(fx, /frame >= 7 && frame <= 8/);
  assert.match(fx, /dice_nat_fx_cancel\(void\)/);
});
test("effects never call the roll generator or power hardware", () => {
  const event = source("dice_nat_event.c");
  const fx = source("dice_nat_fx.c");
  const ui = source("dice_ui.c");
  assert.match(event, /face\.sides != 20 \|\| face\.discarded/);
  assert.match(event, /if \(has_twenty\) return DICE_NAT_20/);
  assert.match(event, /if \(has_one\) return DICE_NAT_1/);
  assert.match(fx, /"NATURAL 20!"/);
  assert.match(fx, /"NATURAL 1!"/);
  assert.match(fx, /"CRITICAL HIT!"/);
  assert.match(fx, /"CRITICAL MISS!"/);
  assert.doesNotMatch(event + fx, /esp_random|dice_roll\(|Math\.random|tab5_power/);
  assert.match(ui, /dice_roll\(g_state, esp_random\)/);
});
