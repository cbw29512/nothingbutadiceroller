#include "dice_controls.h"
#include <stdint.h>

dice_control_result_t dice_apply_control(dice_state_t *state, int code) {
    if (!state || state->phase != DICE_SESSION) return DICE_CONTROL_REJECTED;

    if (code == DICE_CONTROL_CLEAR) {
        dice_clear(state);
        return DICE_CONTROL_REDRAW;
    }
    if (code == DICE_CONTROL_REROLL) {
        // The only control that requests random number generation.
        return state->count ? DICE_CONTROL_ROLL_NOW : DICE_CONTROL_REJECTED;
    }
    if (code == DICE_CONTROL_ADV || code == DICE_CONTROL_DIS) {
        // ADV/DIS uses two d20 faces for each selected d20 check.
        // If none is selected, this control is also a one-d20 shortcut.
        bool has_d20 = false;
        for (int i = 0; i < state->count; ++i) {
            if (state->pool[i] == 20) { has_d20 = true; break; }
        }
        if (!has_d20 && !dice_add(state, 20)) {
            // A full pending pool must survive an unsuccessful shortcut.
            return DICE_CONTROL_REJECTED;
        }
        const dice_mode_t requested = code == DICE_CONTROL_ADV ?
                                      DICE_ADV : DICE_DIS;
        // Press the active mode again to restore an ordinary d20 roll.
        state->mode = state->mode == requested ? DICE_NORMAL : requested;
        state->has_result = false;
        return DICE_CONTROL_REDRAW;
    }
    if (code < 1 || code > UINT8_MAX) return DICE_CONTROL_REJECTED;

    // Tapping dice selects the pool. It MUST NOT consume RNG or roll yet.
    if (!dice_add(state, (uint8_t)code)) return DICE_CONTROL_REJECTED;
    return DICE_CONTROL_REDRAW;
}
