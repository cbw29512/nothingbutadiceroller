#pragma once
#include "dice_engine.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define DICE_VISIBLE_MAX (DICE_MAX * 2)

typedef struct {
    uint8_t sides;
    uint16_t face;
    uint8_t selected_index; // Groups each ADV/DIS pair with its original test.
    bool secondary;
    bool discarded;
} dice_visible_face_t;

// Pure view mapping: no RNG, LVGL, side effects, or synthetic faces.
size_t dice_result_visible_count(const dice_state_t *state);
bool dice_result_visible_at(const dice_state_t *state, size_t visible_index,
                            dice_visible_face_t *out);
