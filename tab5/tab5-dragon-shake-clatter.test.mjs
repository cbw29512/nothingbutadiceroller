import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function c(name) {
  try {
    return readFileSync(new URL("./native/main/" + name, import.meta.url), "utf8");
  } catch (err) {
    console.error("Missing native dice enhancement source:", name, err);
    throw err;
  }
}
test("dragon and broken d20 use only ephemeral vector art", () => {
  const art = c("dice_critical_art.c");
  const fx = c("dice_nat_fx.c");
  assert.match(fx, /lv_obj_add_event_cb\(overlay, dice_critical_art_draw/);
  assert.match(fx, /art.frame = frame/);
  assert.match(fx, /dice_nat_fx_cancel\(\)/);
  assert.match(art, /dice_critical_art_draw/);
  assert.match(art, /lv_draw_triangle\(layer,&d\)/);
  assert.match(art, /lv_draw_line\(layer,&d\)/);
  assert.match(art, /DICE_NAT_20\) dragon/);
  assert.match(art, /DICE_NAT_1\) shattered/);
  assert.doesNotMatch(art + fx, /lv_image_create|malloc\(|esp_random|wifi|http/);
});
test("clatter is derived from actual physics collisions not random rolls", () => {
  const motion = c("dice_motion.c");
  const tray = c("dice_tray.c");
  const sound = c("dice_nat_sound.c");
  const impact = c("dice_impact_audio.c");
  assert.match(motion, /scene->impacts\+\+/);
  assert.match(motion, /scene->impacts = 0/);
  assert.match(tray, /motion.impacts &&/);
  assert.match(tray, /motion.frame-last_clack_frame >= 6/);
  assert.match(tray, /dice_nat_sound_impact\(false\)/);
  assert.match(tray, /motion.frame == 50\) dice_nat_sound_impact\(true\)/);
  assert.match(sound, /xQueueSend\(sound_queue, &cue, 0\)/);
  assert.match(sound, /xQueueOverwrite\(sound_queue, &cue\)/);
  assert.match(impact, /dice_impact_audio_sample/);
  assert.doesNotMatch(impact, /esp_random|dice_roll|malloc|rand\(/);
});
test("shake reuses BMI270 orientation samples and refuses busy rolls", () => {
  const imu = c("orientation.c");
  const shake = c("dice_shake_policy.c");
  const ui = c("dice_ui.c");
  assert.match(imu, /dice_shake_policy_sample\(&shake, x, y, z, ms\)/);
  assert.match(imu, /if \(bsp_display_lock\(0\)\)/);
  assert.match(imu, /dice_ui_try_shake_roll\(\)/);
  assert.match(shake, /p->peaks < 3/);
  assert.match(shake, /1500u/);
  assert.match(shake, /3000u/);
  assert.match(shake, /p->calm_samples >= 5/);
  assert.match(ui, /g_state->phase != DICE_SESSION/);
  assert.match(ui, /dice_tray_is_rolling\(\)/);
  assert.match(ui, /dice_nat_fx_is_active\(\)/);
  assert.match(ui, /return roll_start\(\)/);
  assert.match(ui, /dice_roll\(g_state, esp_random\)/);
  assert.doesNotMatch(shake, /esp_random|dice_roll|dice_clear/);
});
test("enhancements preserve visible ten buttons and battery init path", () => {
  const ui = c("dice_ui.c");
  const main = c("main.c");
  const cmake = c("CMakeLists.txt");
  assert.match(ui, /g_controls\[10\]/);
  assert.match(ui, /"ADV", "DIS", "ROLL"/);
  assert.doesNotMatch(ui, /"CLEAR"/);
  assert.match(main, /tab5_board_poweroff_idle_init\(\)/);
  assert.match(main, /tab5_power_init\(\)/);
  assert.match(cmake, /"dice_shake_policy.c"/);
  assert.match(cmake, /"dice_critical_art.c"/);
  assert.match(cmake, /"dice_impact_audio.c"/);
});
