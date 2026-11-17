#pragma once
#include "dice_engine.h"
#include "lvgl.h"

// This presentation module owns the drawn objects and animation timer.
// The dice engine still owns every actual random result.
void dice_tray_bind(lv_obj_t *tray);
void dice_tray_clear(void);
void dice_tray_release(void);
void dice_tray_render(const dice_state_t *state);
void dice_tray_relayout(void);
// A second shake must never interrupt an in-flight animation.
bool dice_tray_is_rolling(void);

// Called once when a roll actually settles (including timer-failure fallback).
void dice_tray_set_settled_callback(void (*callback)(void));
