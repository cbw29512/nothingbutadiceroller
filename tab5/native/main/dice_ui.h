#pragma once
#include "dice_engine.h"
void dice_ui_start(dice_state_t *state);

// Called only while holding the BSP LVGL mutex after rotation.
void dice_ui_relayout(void);
