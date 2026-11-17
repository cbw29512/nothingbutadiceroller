#include "dice_controls.h"
#include <stdint.h>

dice_control_result_t dice_apply_control(dice_state_t *state, int code) {
    if (!state || state->phase != DICE_SESSION) return DICE_CONTROL_REJECTED;

    if (code == DICE_CONTROL_CLEAR) {
        dice_clear(state);
        return DICE_CONTROL_REDRAW;
    }
    if (code == DICE_CONTROL_REROLL) {
        // ROLL rerolls the selected pool; ADV/DIS are one-tap quick rolls.
        return state->count ? DICE_CONTROL_ROLL_NOW : DICE_CONTROL_REJECTED;
    }
    if (code == DICE_CONTROL_ADV || code == DICE_CONTROL_DIS) {
        // Quick roll: always one d20 test, represented by two physical d20s.
        // Clear even a pending mixed pool: ADV/DIS cannot stack or toggle.
        dice_clear(state);
        if (!dice_add(state, 20)) return DICE_CONTROL_REJECTED;
        state->mode = code == DICE_CONTROL_ADV ? DICE_ADV : DICE_DIS;
        // The UI performs the secure roll exactly once for this action.
        return DICE_CONTROL_ROLL_NOW;
    }
    if (code < 1 || code > UINT8_MAX) return DICE_CONTROL_REJECTED;

    // Tapping dice selects the pool. It MUST NOT consume RNG or roll yet.
    if (!dice_add(state, (uint8_t)code)) return DICE_CONTROL_REJECTED;
    return DICE_CONTROL_REDRAW;
}
