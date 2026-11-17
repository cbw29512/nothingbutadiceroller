#pragma once
#include "lvgl.h"
#include <stdbool.h>
#include <stdint.h>

// Attach a lightweight LVGL draw callback. This changes pixels only,
// never modifies dice outcomes or input state.
bool dice_shapes_attach(lv_obj_t *object, uint8_t sides,
                        uint16_t outcome, bool discarded,
                        bool percentile_tens);

// True when source values are already painted on a physical polyhedral face.
bool dice_shapes_has_embedded_numbers(lv_obj_t *object);

// Rendering-only rotation in 0.1 degrees, disconnected from actual game faces.
void dice_shapes_set_tumble(lv_obj_t *object,bool enabled,bool moving,
                            int pitch,int yaw,int roll);
