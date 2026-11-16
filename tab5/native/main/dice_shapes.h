#pragma once
#include "lvgl.h"
#include <stdbool.h>
#include <stdint.h>

// Attach a lightweight LVGL draw callback. This changes pixels only,
// never modifies dice outcomes or input state.
void dice_shapes_attach(lv_obj_t *object, uint8_t sides, bool discarded);

// Rendering-only rotation in 0.1 degrees, disconnected from actual game faces.
void dice_shapes_set_tumble(lv_obj_t *object,bool enabled,
                            int pitch,int yaw,int roll);
