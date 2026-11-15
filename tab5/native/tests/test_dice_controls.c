#include "../main/dice_controls.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>

static uint32_t value;
static uint32_t sample(void) { return value++; }

int main(void) {
    dice_state_t state;
    dice_state_reset(&state);
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REJECTED);
    assert(dice_select(&state, 0));
    assert(dice_confirm(&state));

    assert(dice_apply_control(&state, 20) == DICE_CONTROL_ROLL_NOW);
    assert(state.count == 1 && state.pool[0] == 20);
    value = 0;
    assert(dice_roll(&state, sample));
    assert(state.has_result && state.total == 1);

    // A second tap builds the pool and triggers another visible roll.
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_ROLL_NOW);
    assert(state.count == 2);
    value = 0;
    assert(dice_roll(&state, sample));
    assert(state.total == 3);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);

    assert(dice_apply_control(&state, DICE_CONTROL_ADV) == DICE_CONTROL_ROLL_NOW);
    assert(state.count == 1 && state.mode == DICE_ADV);
    value = 0;
    assert(dice_roll(&state, sample));
    assert(state.faces[0] == 1 && state.faces[1] == 2 && state.total == 2);

    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_ROLL_NOW);
    assert(state.count == 1 && state.mode == DICE_DIS);
    value = 0;
    assert(dice_roll(&state, sample));
    assert(state.total == 1);

    assert(dice_apply_control(&state, DICE_CONTROL_CLEAR) == DICE_CONTROL_REDRAW);
    assert(state.count == 0 && !state.has_result);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, 999) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, -100) == DICE_CONTROL_REJECTED);
    printf("Tab5 dice control state transitions passed\n");
    return 0;
}
