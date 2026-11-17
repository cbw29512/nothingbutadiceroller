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
