#pragma once
#include "dice_engine.h"

// Pure state transition: the UI owns rendering and RNG, never this module.
typedef enum {
    DICE_CONTROL_REJECTED = 0,
    DICE_CONTROL_REDRAW = 1,
    DICE_CONTROL_ROLL_NOW = 2
} dice_control_result_t;

// Negative values are reserved for actions, positive values are die sides.
enum {
    DICE_CONTROL_CLEAR = 0,
    DICE_CONTROL_REROLL = -1,
    DICE_CONTROL_ADV = -2,
    DICE_CONTROL_DIS = -3
};

dice_control_result_t dice_apply_control(dice_state_t *state, int code);
