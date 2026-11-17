#pragma once
#include "dice_nat_event.h"
#include "lvgl.h"

// Frame-owned vector illustration; no images, animation buffers, or new UI.
typedef struct {
    dice_nat_event_t event;
    unsigned frame;
} dice_critical_art_t;

void dice_critical_art_draw(lv_event_t *event);
