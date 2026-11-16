#include "dice_summary.h"
#include <stdio.h>

bool dice_summary_format(const dice_state_t *state, char *buf, size_t capacity) {
    if (!state || !buf || capacity < 2) return false;
    buf[0] = '\0';
    if (!state->count) {
        return snprintf(buf, capacity, "Select dice above, then tap ROLL") <
               (int)capacity;
    }
    static const uint8_t sides[] = {4, 6, 8, 10, 12, 20, 100};
    size_t offset = 0;
    for (unsigned k = 0; k < sizeof(sides) / sizeof(sides[0]); ++k) {
        unsigned quantity = 0;
        for (unsigned i = 0; i < state->count; ++i)
            if (state->pool[i] == sides[k]) ++quantity;
        if (!quantity) continue;
        const int length = snprintf(buf + offset, capacity - offset,
                                    "%s%ud%u", offset ? " + " : "",
                                    quantity, (unsigned)sides[k]);
        if (length < 0 || (size_t)length >= capacity - offset) return false;
        offset += (size_t)length;
    }
    const char *mode = state->mode == DICE_ADV ? " | ADV" :
                       state->mode == DICE_DIS ? " | DIS" : "";
    const int length = state->has_result
        ? snprintf(buf + offset, capacity - offset, "%s | TOTAL %ld",
                   mode, (long)state->total)
        : snprintf(buf + offset, capacity - offset, "%s | TAP ROLL", mode);
    return length >= 0 && (size_t)length < capacity - offset;
}
