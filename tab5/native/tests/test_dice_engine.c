#include "../main/dice_engine.h"
#include <assert.h>
#include <stdio.h>
#include <stdint.h>

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
    assert(s.faces[0] == 2 && s.faces[1] == 3 && s.total == 3);
    s.mode = DICE_DIS;
    assert(dice_roll(&s, sequence));
    assert(s.total == s.faces[0] || s.total == s.faces[1]);
    dice_clear(&s);
    for (int i = 0; i < DICE_MAX; ++i) assert(dice_add(&s, 6));
    assert(!dice_add(&s, 6));
    printf("Native C dice engine unit tests passed\n");
    return 0;
}
