#pragma once
#include <stdint.h>

typedef struct {
    int width;          // Available inner tray width in pixels.
    int height;         // Visible tray height in pixels, not total scroll content.
    int size;           // Die diameter, clamped but never shrunken for a large pool.
    int gap;            // Minimum space between adjacent dice.
    int columns;        // Visible columns; additional rows may scroll.
    int count;          // Includes one extra d20 per ADV/DIS test.
} dice_layout_t;

// Pure layout calculations; LVGL and RNG do not participate.
dice_layout_t dice_layout_make(int count, int width, int height);
void dice_layout_position(const dice_layout_t *layout, int index, int *x, int *y);
