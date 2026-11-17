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
    // An empty session footer must not show any instruction prompts.
    assert(dice_summary_format(&s, summary, sizeof(summary)));
    assert(strcmp(summary, "") == 0);
    assert(dice_add(&s, 20) && dice_add(&s, 20));
    assert(dice_summary_format(&s, summary, sizeof(summary)));
    assert(strcmp(summary, "2d20") == 0);
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

    // One logical d100 is exactly two FULL SIZE physical ten-sided dice.
    // It still consumes ONE secure 1..100 RNG draw and contributes once.
    dice_clear(&s);
    assert(dice_add(&s, 100));
    value = 99;
    assert(dice_roll(&s, next_value));
    assert(value == 100 && s.total == 100 && s.faces[0] == 100);
    assert(dice_result_visible_count(&s) == 2);
    assert(dice_result_visible_at(&s, 0, &die));
    assert(die.sides == 100 && die.face == 100);
    assert(die.percentile_tens && !die.secondary && !die.discarded);
    assert(dice_result_visible_at(&s, 1, &die));
    assert(die.sides == 100 && die.face == 100);
    assert(!die.percentile_tens && die.secondary && !die.discarded);
    assert(!dice_result_visible_at(&s, 2, &die));

    // Two logical percentile dice must show four physical d10s.
    dice_clear(&s);
    assert(dice_add(&s, 100) && dice_add(&s, 100));
    value = 0;
    assert(dice_roll(&s, next_value));
    assert(s.total == 3 && value == 2);
    assert(dice_result_visible_count(&s) == 4);
    for (size_t i = 0; i < 4; ++i) {
        assert(dice_result_visible_at(&s, i, &die));
        assert(die.sides == 100 && die.selected_index == i / 2);
        assert(die.percentile_tens == (i % 2 == 0));
        assert(die.secondary == (i % 2 == 1));
        assert(!die.discarded);
    }

    // Mixed pools keep the right order and do not multiply totals.
    dice_clear(&s);
    assert(dice_add(&s, 6) && dice_add(&s, 100) && dice_add(&s, 20));
    value = 0;
    assert(dice_roll(&s, next_value));
    assert(s.total == 6 && dice_result_visible_count(&s) == 4);
    assert(dice_result_visible_at(&s, 0, &die));
    assert(die.sides == 6 && !die.percentile_tens);
    assert(dice_result_visible_at(&s, 1, &die));
    assert(die.sides == 100 && die.percentile_tens);
    assert(dice_result_visible_at(&s, 2, &die));
    assert(die.sides == 100 && !die.percentile_tens);
    assert(dice_result_visible_at(&s, 3, &die));
    assert(die.sides == 20 && !die.percentile_tens);

    // Worst-case physical pool is exactly 64 d10 widgets.
    dice_clear(&s);
    for (int i = 0; i < DICE_MAX; ++i) assert(dice_add(&s, 100));
    value = 0;
    assert(dice_roll(&s, next_value));
    assert(dice_result_visible_count(&s) == DICE_VISIBLE_MAX);
    assert(dice_result_visible_at(&s, DICE_VISIBLE_MAX - 1, &die));
    assert(die.sides == 100 && die.secondary);
    assert(!dice_result_visible_at(&s, DICE_VISIBLE_MAX, &die));
    puts("Tab5 d20, full-size d100 presentation, and summary mapping passed");
    return 0;
}
