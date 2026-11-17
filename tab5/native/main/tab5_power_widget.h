#pragma once
#include "lvgl.h"

// Shows a compact battery diagnostic without changing dice state.
void tab5_power_widget_attach(lv_obj_t *screen);

// Drop the widget reference before the screen is cleared.
void tab5_power_widget_detach(void);
