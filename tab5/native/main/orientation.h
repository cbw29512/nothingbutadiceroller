#pragma once
#include "lvgl.h"
// Starts accelerometer-driven orientation monitoring without blocking LVGL.
// The display remains usable at its default orientation if IMU startup fails.
void orientation_start(lv_display_t *display);
