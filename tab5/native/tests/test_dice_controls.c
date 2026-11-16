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

    // ROLL again replaces previous faces without changing the selected pool.
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    sample = 7;
    assert(dice_roll(&state, draws));
    assert(sample == 9 && state.count == 2 && state.total == 17);
    assert(state.faces[0] == 8 && state.faces[1] == 9);

    // A new die after a completed roll starts a completely fresh pool.
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.pool[0] == 6);
    assert(state.mode == DICE_NORMAL && !state.has_result);
    assert(state.total == 0 && state.faces[0] == 0);
    sample = 0;
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(sample == 1 && state.total == 1);
    // A rejected selection never removes valid previously rolled results.
    assert(dice_apply_control(&state, 999) == DICE_CONTROL_REJECTED);
    assert(state.count == 1 && state.has_result && state.total == 1);

    assert(dice_apply_control(&state, DICE_CONTROL_CLEAR) == DICE_CONTROL_REDRAW);
    assert(state.count == 0 && !state.has_result && state.mode == DICE_NORMAL);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_REJECTED);

    // Regression: tapping ADV without first selecting d20 queues one test.
    assert(dice_apply_control(&state, DICE_CONTROL_ADV) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.pool[0] == 20 && state.mode == DICE_ADV);
    assert(!state.has_result);
    sample = 0;
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(sample == 2 && state.faces[0] == 1);
    assert(state.second_faces[0] == 2 && state.total == 2);
    // A repeated ROLL clears/replaces the faces and retains ADV mode.
    sample = 6;
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(sample == 8 && state.total == 8 && state.mode == DICE_ADV);
    // Switching to DIS after a completed roll reuses the d20 selection.
    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.mode == DICE_DIS && !state.has_result);
    sample = 3;
    assert(dice_roll(&state, draws));
    assert(state.total == 4 && state.second_faces[0] == 5);
    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_REDRAW);
    assert(state.mode == DICE_NORMAL); // Same button toggles its mode off.

    // DIS works directly after CLEAR, without a preceding D20 selection.
    assert(dice_apply_control(&state, DICE_CONTROL_CLEAR) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, DICE_CONTROL_DIS) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.pool[0] == 20 && state.mode == DICE_DIS);
    sample = 0;
    assert(dice_roll(&state, draws));
    assert(state.total == 1 && state.faces[0] == 1 && state.second_faces[0] == 2);
    // After a completed non-d20 roll, ADV starts a fresh d20 selection.
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.pool[0] == 6 && state.mode == DICE_NORMAL);
    sample = 0;
    assert(dice_roll(&state, draws));
    assert(dice_apply_control(&state, DICE_CONTROL_ADV) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.pool[0] == 20 && state.mode == DICE_ADV);
    // For mixed pending pools, ADV appends a d20, keeping existing dice.
    assert(dice_apply_control(&state, DICE_CONTROL_CLEAR) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, DICE_CONTROL_ADV) == DICE_CONTROL_REDRAW);
    assert(state.count == 2 && state.pool[0] == 6 && state.pool[1] == 20);
    assert(state.mode == DICE_ADV);
    sample = 0;
    assert(dice_roll(&state, draws));
    assert(sample == 3 && state.total == 5);
    assert(dice_apply_control(&state, 999) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, -100) == DICE_CONTROL_REJECTED);
    printf("Tab5 queue-then-roll, multi-ADV/DIS tests passed\n");
    return 0;
}
