#include "../main/dice_nat_event.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static dice_state_t session(uint8_t sides, uint16_t first,
                            dice_mode_t mode, uint16_t second) {
    dice_state_t state;
    dice_state_reset(&state);
    assert(dice_select(&state, 0));
    assert(dice_confirm(&state));
    state.count = 1;
    state.pool[0] = sides;
    state.faces[0] = first;
    state.second_faces[0] = second;
    state.mode = mode;
    state.has_result = true;
    return state;
}
static void expect(dice_state_t state, dice_nat_event_t event) {
    const dice_state_t original = state;
    assert(dice_nat_event_detect(&state) == event);
    assert(memcmp(&state, &original, sizeof(state)) == 0);
}
int main(void) {
    assert(dice_nat_event_detect(NULL) == DICE_NAT_NONE);
    dice_state_t state = session(20, 20, DICE_NORMAL, 0);
    state.has_result = false;
    expect(state, DICE_NAT_NONE);
    state.phase = DICE_CONFIRM;
    state.has_result = true;
    expect(state, DICE_NAT_NONE);

    expect(session(20, 20, DICE_NORMAL, 0), DICE_NAT_20);
    expect(session(20, 1, DICE_NORMAL, 0), DICE_NAT_1);
    expect(session(20, 19, DICE_NORMAL, 0), DICE_NAT_NONE);
    expect(session(6, 1, DICE_NORMAL, 0), DICE_NAT_NONE);
    expect(session(100, 20, DICE_NORMAL, 0), DICE_NAT_NONE);

    // ADV/DIS triggers from the *kept* face only, not a discarded die.
    expect(session(20, 1, DICE_ADV, 20), DICE_NAT_20);
    expect(session(20, 20, DICE_ADV, 1), DICE_NAT_20);
    expect(session(20, 1, DICE_DIS, 20), DICE_NAT_1);
    expect(session(20, 20, DICE_DIS, 1), DICE_NAT_1);
    expect(session(20, 20, DICE_DIS, 19), DICE_NAT_NONE);
    expect(session(20, 1, DICE_ADV, 2), DICE_NAT_NONE);
    expect(session(20, 20, DICE_ADV, 20), DICE_NAT_20);
    expect(session(20, 1, DICE_DIS, 1), DICE_NAT_1);

    // Multiple normal d20s: NAT20 takes presentation precedence.
    state = session(20, 1, DICE_NORMAL, 0);
    state.count = 2;
    state.pool[1] = 20;
    state.faces[1] = 20;
    expect(state, DICE_NAT_20);
    // Mixed die pools ignore d4/d6/d10/d100 extremes.
    state.pool[1] = 6;
    state.faces[1] = 1;
    expect(state, DICE_NAT_1);
    puts("Tab5 selected natural 20/1 visual event tests passed");
    return 0;
}
