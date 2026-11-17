#include "dice_layout.h"

// These tiers are physical visual sizes, not die values.
dice_layout_t dice_layout_make(int count, int width, int height) {
    dice_layout_t result = {0};
    result.width = width > 0 ? width : 1;
    result.height = height > 0 ? height : 1;
    result.count = count > 0 ? count : 0;
    result.gap = count <= 4 ? 18 : 12;
    int desired = count <= 1 ? 230 :
                  count <= 2 ? 200 :
                  count <= 4 ? 170 :
                  count <= 8 ? 136 :
                  count <= 12 ? 114 : 104;
    int limit = result.width - 16;
    if (result.count <= 1 && result.height - 16 < limit) limit = result.height - 16;
    if (limit < 40) limit = 40;
    result.size = desired < limit ? desired : limit;
    result.columns = (result.width - 12 + result.gap) / (result.size + result.gap);
    if (result.columns < 1) result.columns = 1;
    if (result.count > 0 && result.columns > result.count)
        result.columns = result.count;
    return result;
}

void dice_layout_position(const dice_layout_t *layout, int index, int *x, int *y) {
    if (!x || !y) return;
    *x = 0;
    *y = 0;
    if (!layout || layout->columns < 1 || index < 0 || index >= layout->count) return;
    const int row = index / layout->columns;
    const int col = index % layout->columns;
    const int row_start = row * layout->columns;
    const int remaining = layout->count - row_start;
    const int row_count = remaining < layout->columns ? remaining : layout->columns;
    const int row_width = row_count * layout->size + (row_count - 1) * layout->gap;
    const int total_rows = (layout->count + layout->columns - 1) / layout->columns;
    const int total_height = total_rows * layout->size +
                             (total_rows - 1) * layout->gap;
    const int left = (layout->width - row_width) / 2;
    const int top = total_height < layout->height ?
                    (layout->height - total_height) / 2 : 6;
    *x = left + col * (layout->size + layout->gap);
    *y = top + row * (layout->size + layout->gap);
}
