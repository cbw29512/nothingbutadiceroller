#pragma once
#include "dice_engine.h"
void dice_ui_start(dice_state_t *state);
// Called with LVGL lock after deliberate shake; rejects empty/busy sessions.
bool dice_ui_try_shake_roll(void);

// Called only while holding the BSP LVGL mutex after rotation.
void dice_ui_relayout(void);
