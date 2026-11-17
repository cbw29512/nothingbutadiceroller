#pragma once
#include "lvgl.h"
#include <stdbool.h>
#include <stdint.h>

// Paint one verified solid die with stable per-face numbering.
// face_text points to persistent strings owned by the LVGL die widget.
bool dice_mesh_paint(lv_layer_t *layer, const lv_area_t *area, uint8_t sides,
                     bool discarded, bool moving, int pitch, int yaw, int roll,
                     const char face_text[20][4]);

// Low-cost percentile fallback still displays two independently numbered d10s.
void dice_mesh_paint_fallback_number(lv_layer_t *layer, const lv_area_t *area,
                                     const char *text);
