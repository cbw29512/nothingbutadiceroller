import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (file) => {
  try {
    return readFileSync(new URL("./native/main/" + file, import.meta.url), "utf8");
  } catch (error) {
    console.error("Tab5 render contract source unavailable:", file, error);
    throw error;
  }
};

test("each button maps to its own actual polyhedron", () => {
  const mesh = source("dice_mesh.c");
  for (const token of ["SELECT(tetra,tf)", "SELECT(cube,cf)",
    "SELECT(octa,of)", "SELECT(deca,df)", "SELECT(dodeca,dodf)",
    "SELECT(ico,icof)"]) assert.ok(mesh.includes(token), token);
  assert.match(mesh, /case 10: case 100: SELECT\(deca,df\)/);
});

test("d100 uses two full-sized dice instead of one half-sized composite", () => {
  const results = source("dice_results.c");
  assert.match(results, /uses_pair\(state, i\) \|\| is_percentile\(state, i\)/);
  assert.match(results, /const size_t slots = pair \|\| percentile \? 2 : 1/);
  assert.match(results, /percentile_tens = percentile && !secondary/);
  const shapes = source("dice_shapes.c");
  assert.match(shapes, /dice_mesh_paint\(layer, &area, state->sides/);
  assert.doesNotMatch(shapes, /lv_area_t tens/);
  const tray = source("dice_tray.c");
  assert.match(tray, /face\.percentile_tens/);
  assert.match(tray, /dice_visual_resize\(dice\[i\], layout\.size\)/);
  const values = source("dice_face_values.c");
  assert.match(values, /result == 100 \? 0u/);
  assert.match(values, /"%02u"/);
});

test("visible values are painted on faces and not duplicated as floating labels", () => {
  const shape = source("dice_shapes.c");
  assert.match(shape, /dice_face_text\(sides,\s*outcome/);
  const painter = source("dice_mesh_painter.c");
  assert.match(painter, /draw_face_number\(layer,area,face/);
  assert.match(painter, /desc\.text=text/);
  const tray = source("dice_tray.c");
  assert.match(tray, /dice_shapes_has_embedded_numbers\(dice\[i\]\)/);
  assert.match(tray, /dice_shapes_set_tumble\(dice\[i\], finished, 0, 0, 0\)/);
});

test("the secure game engine is separate from visual rendering", () => {
  for (const file of ["dice_shapes.c", "dice_face_values.c",
    "dice_mesh_painter.c", "dice_project.c"]) {
    const content = source(file);
    assert.doesNotMatch(content, /esp_random|dice_roll\s*\(/);
  }
});

test("die type text never floats over physical die faces", () => {
  const visuals = source("dice_visuals.c");
  // Only numbered physical faces may identify the die during a toss.
  assert.doesNotMatch(visuals, /lv_label_set_text_fmt\(type_label/);
  assert.doesNotMatch(visuals, /lv_label_set_text_fmt\([^;]*"d%u%s"/);
  // Preserve first-child face label, but never allocate overlay labels.
  assert.match(visuals, /face_label = lv_label_create\(die\)/);
  assert.equal((visuals.match(/lv_label_create\(die\)/g) ?? []).length, 1);
  // The visual discard state is color-only; never put text on dice.
  assert.doesNotMatch(visuals, /lv_label_set_text\(out_label/);
  const painter = source("dice_mesh_painter.c");
  assert.match(painter, /base_color\(sides,discarded\)/);
});
