import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function code(name) {
  try {
    return readFileSync(new URL("./native/main/" + name, import.meta.url), "utf8");
  } catch (error) {
    console.error("Tab5 visual digit contract unavailable:", name, error);
    throw error;
  }
}

test("moving numbers are confined to visible projected polygon interiors", () => {
  const label = code("dice_label_fit.c");
  const painter = code("dice_mesh_painter.c");
  assert.match(label, /point_inside_convex/);
  assert.match(label, /point_inside_convex\(face, x0, y0\)/);
  assert.match(label, /point_inside_convex\(face, x1, y0\)/);
  assert.match(label, /point_inside_convex\(face, x0, y1\)/);
  assert.match(label, /point_inside_convex\(face, x1, y1\)/);
  assert.match(painter, /moving && !dice_label_fits_face/);
  assert.match(painter, /strlen\(text\)>1\?30:20/);
});

test("movement state reaches painter without altering die face values", () => {
  const shapes = code("dice_shapes.c");
  const tray = code("dice_tray.c");
  const engine = code("dice_engine.c");
  assert.match(tray, /dice_shapes_set_tumble\(dice\[i\], true, !finished/);
  assert.match(tray, /dice_shapes_set_tumble\(dice\[i\], finished, !finished/);
  assert.match(shapes, /state->moving, state->front_pitch/);
  assert.match(shapes, /if \(state->sides == 100 && !state->moving\)/);
  assert.match(tray, /dice_visual_set_rolling/);
  assert.match(engine, /dice_unbiased\(sides, rng\)/);
  assert.doesNotMatch(painterContent(), /dice_roll|esp_random/);
});

function painterContent() {
  return code("dice_mesh_painter.c");
}

test("only the settled selected face illuminates", () => {
  const painter = code("dice_mesh_painter.c");
  const shapes = code("dice_shapes.c");
  const values = code("dice_face_values.c");
  const tray = code("dice_tray.c");

  // Source face zero is oriented frontmost at rest and carries the actual
  // result, including tens/units for a percentile pair.
  assert.match(shapes, /dice_mesh_front_angles\(&mesh, 0/);
  assert.match(values, /const unsigned offset = \(face_index \+ count - front_index\) % count/);

  // The selected face alone lights when settled, never during movement
  // and never on an ADV/DIS discarded die.
  assert.match(painter, /const bool winner=!moving && !discarded && face->source_index==0/);
  assert.match(painter, /const uint32_t filled=winner\?0x142637:shade_color/);
  assert.match(painter, /edge\.color=lv_color_hex\(winner\?0xE7FF00:/);
  assert.match(painter, /desc\.color=lv_color_hex\(winner\?0xE7FF00:/);
  assert.match(painter, /draw_face_number\(layer,area,face,face_text\[face->source_index\],moving,winner,discarded\)/);
  assert.match(tray, /dice_shapes_set_tumble\(dice\[i\], true, !finished/);
  // Physical photo regression: side faces should never look bright white.
  assert.match(painter, /desc\.opa=winner\?LV_OPA_COVER:discarded\?LV_OPA_40:LV_OPA_60/);
  assert.match(painter, /discarded\?0x596575:/);
  assert.match(painter, /face->shade<158\?0x8594A6:0x344356/);
  assert.match(painter, /const bool winner_large=winner/);
  assert.match(painter, /dice_label_fits_face\(face,x,y,win_width,40\)/);
  assert.match(painter, /edge\.width=winner\?5:/);
  assert.doesNotMatch(painter, /0xFFF1A0|0xFFF19B|0xFFFFFF/);
  assert.doesNotMatch(painter, /esp_random|dice_roll/);
});

test("secure random source resolves results before visual animation", () => {
  const ui = code("dice_ui.c");
  const engine = code("dice_engine.c");
  const tray = code("dice_tray.c");
  const rngCall = ui.indexOf("dice_roll(g_state, esp_random)");
  const drawCall = ui.indexOf("dice_tray_render(g_state)");
  assert.ok(rngCall >= 0 && drawCall > rngCall);
  assert.match(engine, /const uint64_t limit = \(range \/ sides\) \* sides/);
  assert.match(engine, /if \(\(uint64_t\)raw < limit\)/);
  assert.match(tray, /ESP hardware RNG supplies a throw trajectory only/);
  assert.doesNotMatch(engine, /Math\.random/);
});
