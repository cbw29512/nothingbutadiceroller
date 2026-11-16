#include "../main/dice_layout.h"
#include <assert.h>
#include <stdio.h>

static void verify_pool(int count, int width, int height, int minimum_size) {
    dice_layout_t layout = dice_layout_make(count, width, height);
    assert(layout.count == count && layout.size >= minimum_size);
    assert(layout.columns >= 1);
    for (int i = 0; i < count; ++i) {
        int x, y;
        dice_layout_position(&layout, i, &x, &y);
        assert(x >= 0 && x + layout.size <= width);
        assert(y >= 0);
        for (int j = 0; j < i; ++j) {
            int prev_x, prev_y;
            dice_layout_position(&layout, j, &prev_x, &prev_y);
            assert(x + layout.size <= prev_x || prev_x + layout.size <= x ||
                   y + layout.size <= prev_y || prev_y + layout.size <= y);
        }
    }
}

int main(void) {
    verify_pool(1, 1230, 385, 220);
    verify_pool(2, 1230, 385, 195);
    verify_pool(4, 1230, 385, 165);
    verify_pool(8, 1230, 385, 130);
    verify_pool(12, 1230, 385, 110);
    verify_pool(32, 1230, 385, 100);
    verify_pool(33, 680, 878, 100); // ADV/DIS draw an extra die.
    verify_pool(1, 680, 878, 220);
    int x = -1, y = -1;
    dice_layout_t zero = dice_layout_make(0, 1230, 385);
    dice_layout_position(&zero, 0, &x, &y);
    assert(x == 0 && y == 0);
    puts("Tab5 large-dice layout and no-overlap tests passed");
    return 0;
}
