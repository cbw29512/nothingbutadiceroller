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

test("d100 displays two independent 10-sided solids and percentile numbers", () => {
  const shape = source("dice_shapes.c");
  assert.match(shape, /state->sides!=100/);
  assert.match(shape, /draw_one\(layer,&tens,state,0\)/);
  assert.match(shape, /draw_one\(layer,&units,state,1\)/);
  assert.match(shape, /sides==100\?10:sides/);
  const values = source("dice_face_values.c");
  assert.match(values, /result == 100 \? 0u/);
  assert.match(values, /"%02u"/);
});

test("visible values are painted on faces and not duplicated as floating labels", () => {
  const shape = source("dice_shapes.c");
  assert.match(shape, /dice_face_text\(sides,outcome/);
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
  // Preserve the first-child contract used by dice_visual_set_rolling().
  assert.ok(visuals.indexOf("lv_label_create(die)") <
            visuals.indexOf("if (discarded) {"));
  // Keep one visible muted-die marker for advantage/disadvantage.
  assert.match(visuals, /lv_label_set_text\(out_label, "OUT"\)/);
  assert.match(visuals, /lv_obj_align\(out_label, LV_ALIGN_BOTTOM_MID, 0, 0\)/);
});
