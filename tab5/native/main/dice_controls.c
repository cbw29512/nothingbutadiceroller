#include "dice_controls.h"
#include <stdint.h>

dice_control_result_t dice_apply_control(dice_state_t *state, int code) {
    // Reject invalid phase and missing state before any mutation.
    if (!state || state->phase != DICE_SESSION) return DICE_CONTROL_REJECTED;

    if (code == DICE_CONTROL_CLEAR) {
        dice_clear(state);
        return DICE_CONTROL_REDRAW;
    }
    if (code == DICE_CONTROL_REROLL) {
        return state->count ? DICE_CONTROL_ROLL_NOW : DICE_CONTROL_REJECTED;
    }
    if (code == DICE_CONTROL_ADV || code == DICE_CONTROL_DIS) {
        // ADV/DIS consume precisely one d20; the renderer shows two faces.
        state->mode = code == DICE_CONTROL_ADV ? DICE_ADV : DICE_DIS;
        state->count = 0;
        if (!dice_add(state, 20)) return DICE_CONTROL_REJECTED;
        return DICE_CONTROL_ROLL_NOW;
    }
    if (code < 1 || code > UINT8_MAX) return DICE_CONTROL_REJECTED;

    // Keep the previous pool unchanged when an invalid die is requested.
    if (!dice_add(state, (uint8_t)code)) return DICE_CONTROL_REJECTED;
    state->mode = DICE_NORMAL;
    return DICE_CONTROL_ROLL_NOW;
}
