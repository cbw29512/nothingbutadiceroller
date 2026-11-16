#pragma once
#include "dice_engine.h"
#include "lvgl.h"

// Bottom-line roll information is managed separately from the session screen.
lv_obj_t *dice_ui_footer_create(lv_obj_t *parent);
void dice_ui_footer_update(const dice_state_t *state, lv_obj_t *summary,
                           lv_obj_t *adv_button, lv_obj_t *dis_button);
