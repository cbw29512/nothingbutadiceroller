#pragma once
#include "lvgl.h"
#include <stdint.h>

// Shared large touch target constructor for session and game selection.
lv_obj_t *dice_widget_button(lv_obj_t *parent, const char *name,
                             int w, int h, lv_event_cb_t cb, intptr_t code);
