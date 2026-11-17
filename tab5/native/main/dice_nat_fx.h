#pragma once
#include "dice_nat_event.h"
#include "lvgl.h"

// Nonblocking, LVGL-thread-only overlay, fired after dice settle.
void dice_nat_fx_show(lv_obj_t *screen, dice_nat_event_t event);
void dice_nat_fx_cancel(void);
