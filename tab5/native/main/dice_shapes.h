#pragma once
#include "lvgl.h"
#include <stdbool.h>
#include <stdint.h>

// Attach a lightweight LVGL draw callback. This changes pixels only,
// never modifies dice outcomes or input state.
void dice_shapes_attach(lv_obj_t *object, uint8_t sides, bool discarded);
