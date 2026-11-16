#include "../main/dice_controls.h"
#include "../main/dice_results.h"
#include "../main/dice_summary.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static uint32_t sample;
static uint32_t draws(void) { return sample++; }

// Same path used by the UI: the control configures the pool, then RNG rolls.
static void verify_pair(dice_state_t *state, int action,
                        dice_mode_t mode, uint32_t seed, uint16_t expected) {
    sample = seed;
    assert(dice_apply_control(state, action) == DICE_CONTROL_ROLL_NOW);
    assert(sample == seed); // Controls never consume randomness on their own.
    assert(state->mode == mode && state->count == 1);
    assert(state->pool[0] == 20 && !state->has_result);
    assert(dice_roll(state, draws));
    assert(sample == seed + 2);
    assert(state->total == expected && state->has_result);
    assert(dice_result_visible_count(state) == 2);
    char summary[128];
    assert(dice_summary_format(state, summary, sizeof(summary)));
    assert(strstr(summary, "1d20") && strstr(summary, "TOTAL"));
}

int main(void) {
    dice_state_t state;
    dice_state_reset(&state);
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REJECTED);
    assert(dice_select(&state, 0) && dice_confirm(&state));

    // Ordinary die buttons remain queue-only, ROLL resolves the whole pool.
    sample = 0;
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REDRAW);
    assert(sample == 0 && state.count == 2 && !state.has_result);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(sample == 2 && state.total == 3);
    sample = 7;
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(sample == 9 && state.count == 2 && state.total == 17);

    // Quick ADV is ONE d20 test regardless of previous selected dice.
    verify_pair(&state, DICE_CONTROL_ADV, DICE_ADV, 0, 2);
    verify_pair(&state, DICE_CONTROL_ADV, DICE_ADV, 11, 13);
    // DIS switches modes and also rolls immediately; repeated taps reroll.
    verify_pair(&state, DICE_CONTROL_DIS, DICE_DIS, 3, 4);
    verify_pair(&state, DICE_CONTROL_DIS, DICE_DIS, 7, 8);
    // ROLL can still reroll the last disadvantaged check.
    sample = 15;
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(state.mode == DICE_DIS && state.total == 16 && sample == 17);

    // A new standard die after a completed roll resets ADV/DIS to normal.
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(state.count == 1 && state.pool[0] == 6);
    assert(state.mode == DICE_NORMAL && !state.has_result);
    sample = 0;
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_ROLL_NOW);
    assert(dice_roll(&state, draws));
    assert(sample == 1 && state.total == 1);
    verify_pair(&state, DICE_CONTROL_ADV, DICE_ADV, 0, 2);

    // Pending damage dice are replaced, not included in an ADV/DIS quick check.
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, 8) == DICE_CONTROL_REDRAW);
    assert(state.count == 2 && !state.has_result);
    verify_pair(&state, DICE_CONTROL_DIS, DICE_DIS, 0, 1);
    // Even multiple pending d20s become ONE advantage/disadvantage test.
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, 20) == DICE_CONTROL_REDRAW);
    verify_pair(&state, DICE_CONTROL_ADV, DICE_ADV, 0, 2);

    // Full pending pools can always be replaced by a quick action.
    dice_clear(&state);
    for (int i = 0; i < DICE_MAX; ++i)
        assert(dice_apply_control(&state, 6) == DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&state, 6) == DICE_CONTROL_REJECTED);
    verify_pair(&state, DICE_CONTROL_DIS, DICE_DIS, 0, 1);

    // CLEAR resets the mode and pool, and invalid actions preserve results.
    assert(dice_apply_control(&state, 999) == DICE_CONTROL_REJECTED);
    assert(dice_apply_control(&state, -100) == DICE_CONTROL_REJECTED);
    assert(state.count == 1 && state.has_result && state.mode == DICE_DIS);
    assert(dice_apply_control(&state, DICE_CONTROL_CLEAR) == DICE_CONTROL_REDRAW);
    assert(state.count == 0 && !state.has_result && state.mode == DICE_NORMAL);
    assert(dice_apply_control(&state, DICE_CONTROL_REROLL) == DICE_CONTROL_REJECTED);
    printf("Tab5 immediate single-pair ADV/DIS and normal pool tests passed\\n");
    return 0;
}
