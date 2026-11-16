#pragma once
#include "lvgl.h"
#include <stdbool.h>
#include <stdint.h>

// Cheap 2D fallback for large rolls, preserving the existing die silhouettes.
void dice_silhouette_draw(lv_layer_t *layer,const lv_area_t *area,
                          uint8_t sides,bool discarded);
