#include "../main/dice_engine.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>

static uint32_t sample = 0;
static uint32_t sequence(void) { return sample++; }
static uint32_t max_then_five(void) {
    static int call = 0;
    return call++ == 0 ? UINT32_MAX : 5;
}
int main(void) {
    dice_state_t s;
    dice_state_reset(&s);
    assert(s.phase == DICE_CHOOSE);
    assert(!dice_confirm(&s));
    assert(dice_select(&s, 0));
    assert(!dice_select(&s, 0));
    assert(dice_confirm(&s));
    assert(!dice_select(&s, 0));
    assert(!dice_add(&s, 3));
    assert(dice_add(&s, 6));
    assert(dice_add(&s, 6));
    assert(!s.has_result);
    assert(dice_roll(&s, sequence));
    assert(s.faces[0] == 1 && s.faces[1] == 2);
    assert(s.total == 3);
    assert(dice_unbiased(6, max_then_five) == 6);

    dice_clear(&s);
    assert(s.count == 0);
    assert(dice_add(&s, 20));
    s.mode = DICE_ADV;
    sample = 1;
    assert(dice_roll(&s, sequence));
    assert(s.faces[0] == 2 && s.second_faces[0] == 3 && s.total == 3);
    s.mode = DICE_DIS;
    assert(dice_roll(&s, sequence));
    assert(s.total == s.faces[0] || s.total == s.second_faces[0]);

    // ADV on a d20 does not duplicate a d6 damage die in the same pool.
    dice_clear(&s);
    assert(dice_add(&s, 20) && dice_add(&s, 6));
    s.mode = DICE_ADV;
    sample = 0;
    assert(dice_roll(&s, sequence));
    assert(sample == 3);
    assert(s.faces[0] == 1 && s.second_faces[0] == 2);
    assert(s.faces[1] == 3 && s.second_faces[1] == 0);
    assert(s.total == 5);

    dice_clear(&s);
    for (int i = 0; i < DICE_MAX; ++i) assert(dice_add(&s, 6));
    assert(!dice_add(&s, 6));
    sample = 0;
    assert(dice_roll(&s, sequence));
    assert(s.has_result && s.count == DICE_MAX);
    // A new die must work even if the previous completed pool was full.
    assert(dice_add(&s, 20));
    assert(s.count == 1 && s.pool[0] == 20);
    assert(s.mode == DICE_NORMAL && !s.has_result && s.total == 0);
    assert(!dice_add(&s, 3));
    assert(s.count == 1 && s.pool[0] == 20);
    puts("Native C dice engine unit tests passed");
    return 0;
}
