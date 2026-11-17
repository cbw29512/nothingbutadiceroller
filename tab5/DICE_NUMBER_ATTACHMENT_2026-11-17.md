# Tab5 rolling dice: keep values on their polyhedron faces

## Reported physical issue

- User successfully installed the battery UI cleanup firmware on their Tab5
  via COM5, with firmware SHA-256 verification.
- The device successfully runs on battery after PR #63 recovery.
- User reports that numbers look detached or float away from rotating dice.
- Review found that the LVGL number painter places an **axis-aligned text
  rectangle at each projected face centroid** without checking that the
  rectangle fits inside the angled triangular/kite/pentagonal face.
  This is a presentation defect, not a problem with result generation.

## Data/state contracts

- `dice_state_t.faces`, `second_faces` and `total` are immutable for
  each completed roll; the native engine supplies `esp_random` through
  `dice_unbiased` using rejection sampling. Animation never changes results.
- `dice_project_face_t` contains the per-frame projected polygon corners;
  `die_shape_state_t.moving` tracks presentation-only movement.
- For moving faces, show a number only when a small 20px font text
  rectangle lies **fully inside** the projected convex polygon with
  a 2px clearance from every edge.
- Angle changes can hide edge-on or too-small face labels, as on a real
  turning die. They do not move text outside the die, duplicate the result
  or change face numbering.
- At rest, retain the previous large clear engraved face numbers and the
  selected outcome without changing the final geometry or font sizing.
- For large pools that use spinning low-cost silhouettes, avoid a floating
  percentile fallback label until the number-bearing mesh settles.
- No changes to ESP-IDF entropy, RNG, battery charger, recovery button,
  face assignments, dice physics, orientation or touch.

## Tests

- Pure C `dice_label_fits_face` unit tests include a square, reversed
  winding, diamond and thin triangle, including inside/outside cases.
- JS contracts assert moving state reaches the painter and that the
  game result is generated before the die animation.
- Existing mesh-geometry, face-value, motion and random-number host tests
  must remain passing.
- ESP32-P4 v1.3 CI build and physical verification on COM5 still required.

## Source

- ESP-IDF 6.1.1 ESP32-P4 random: https://docs.espressif.com/projects/esp-idf/en/v6.1.1/esp32p4/api-reference/system/random.html


## Settled result illumination (follow-up to physical feedback)

- The source-mapped result is face index 0; the existing mesh orientation
  places that face nearest the viewer when motion ends.
- While spinning, do **not** highlight a face just because its surface is bright.
- After the roll settles, color **only** the selected die's result face with a
  darker contrasting fill, bright amber numeral, and bright amber border.
- Every other visible face retains legible but subdued numerals. ADV/DIS
  discarded dice never get a winning highlight; ties can leave both selected.
- The two d10 widgets of a d100 each illuminate their result digit, without
  introducing a second roll or changing the percentile interpretation.
- This changes presentation only. RNG, rejection sampling, result-before-
  animation, charging, and recovery behavior remain unchanged.
- Host geometry and mapping tests plus visual contract and firmware CI must
  pass; actual readability/color on Tab5 remains a physical acceptance test.
