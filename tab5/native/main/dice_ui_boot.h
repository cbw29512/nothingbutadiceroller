#pragma once
#include "dice_engine.h"
#include "lvgl.h"

// Owns system selection and confirmation screens; session UI is separate.
void dice_ui_boot_bind(lv_obj_t *screen, dice_state_t *state,
                       void (*clear_screen)(void),
                       void (*show_session)(void));
void dice_ui_boot_show_choose(void);
