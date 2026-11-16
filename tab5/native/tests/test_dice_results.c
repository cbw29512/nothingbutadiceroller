#include "../main/dice_results.h"
#include "../main/dice_summary.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static uint32_t value;
static uint32_t next_value(void) { return value++; }

int main(void) {
    dice_state_t s;
    char summary[128];
    dice_state_reset(&s);
    assert(dice_select(&s, 0) && dice_confirm(&s));
    assert(dice_add(&s, 20) && dice_add(&s, 20));
    assert(dice_summary_format(&s, summary, sizeof(summary)));
    assert(strstr(summary, "2d20") && strstr(summary, "TAP ROLL"));
    assert(dice_result_visible_count(&s) == 0);
    s.mode = DICE_ADV;
    value = 0;
    assert(dice_roll(&s, next_value));
    assert(dice_result_visible_count(&s) == 4);
    // Two different d20 tests: each pair is adjacent.
    dice_visible_face_t die;
    assert(dice_result_visible_at(&s, 0, &die));
    assert(die.face == 1 && die.discarded && die.selected_index == 0);
    assert(dice_result_visible_at(&s, 1, &die));
    assert(die.face == 2 && !die.discarded && die.selected_index == 0);
    assert(dice_result_visible_at(&s, 2, &die));
    assert(die.face == 3 && die.discarded && die.selected_index == 1);
    assert(dice_result_visible_at(&s, 3, &die));
    assert(die.face == 4 && !die.discarded && die.selected_index == 1);
    assert(!dice_result_visible_at(&s, 4, &die));
    assert(dice_summary_format(&s, summary, sizeof(summary)));
    assert(strstr(summary, "ADV") && strstr(summary, "2 D20 TESTS"));
    assert(!strstr(summary, "TOTAL"));

    dice_clear(&s);
    assert(dice_add(&s, 20) && dice_add(&s, 6));
    s.mode = DICE_DIS;
    value = 0;
    assert(dice_roll(&s, next_value));
    assert(dice_result_visible_count(&s) == 3);
    assert(dice_result_visible_at(&s, 2, &die));
    assert(die.sides == 6 && !die.discarded && !die.secondary);
    assert(!dice_summary_format(&s, summary, 3));
    puts("Tab5 multi-d20 result mapping and pending summary passed");
    return 0;
}
