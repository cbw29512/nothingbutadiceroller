#include "../main/dice_controls.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>

static uint32_t sample;
static uint32_t draws(void) { return sample++; }

int main(void) {
    dice_state_t state;
    dice_state_reset(&state);
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REJECTED);
    assert(dice_select(&state, 0) && dice_confirm(&state));
    // Repeated die taps only queue selections; zero random draws.
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REDRAW);
    assert(state.count == 2 && !state.has_result);
    assert(state.pool[0] == 20 && state.pool[1] == 20);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    sample = 0;
    assert(dice_roll(&state, draws));
    assert(sample == 2 && state.total == 3);

    // ADV and DIS change mode but never roll by themselves.
    assert(dice_apply_control(&state, DICE_CONTROL_ADV) == DICE_CONTROL_REDRAW);
    assert(state.mode == DICE_ADV && !state.has_result);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    sample = 0;
    assert(dice_roll(&state, draws));
    assert(sample == 4 && state.total == 6);
    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_REDRAW);
    sample = 0;
    assert(dice_roll(&state, draws));
    assert(sample == 4 && state.total == 4);
    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_REDRAW);
    assert(state.mode == DICE_NORMAL);

    assert(dice_apply_control(&state, DICE_CONTROL_CLEAR) == DICE_CONTROL_REDRAW);
    assert(state.count == 0 && !state.has_result && state.mode == DICE_NORMAL);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, DICE_CONTROL_ADV) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, 999) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, -100) == DICE_CONTROL_REJECTED);
    printf("Tab5 queue-then-roll, multi-ADV/DIS tests passed\n");
    return 0;
}
