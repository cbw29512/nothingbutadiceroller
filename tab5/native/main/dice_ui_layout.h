#pragma once
#include "dice_engine.h"
#include "lvgl.h"

// Reflows button controls and dice tray after an LVGL display rotation.
void dice_ui_layout_reflow(const dice_state_t *state, lv_obj_t *const controls[11],
                           lv_obj_t *tray, lv_obj_t *summary);
