#include "dice_summary.h"
#include <stdio.h>

bool dice_summary_format(const dice_state_t *state, char *buf, size_t capacity) {
    if (!state || !buf || capacity < 2 || state->count > DICE_MAX) return false;
    buf[0] = '\0';
    if (!state->count) {
        const int n = snprintf(buf, capacity, "Select dice + ROLL, or tap ADV / DIS");
        return n >= 0 && (size_t)n < capacity;
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
    unsigned d20_count = 0;
    for (unsigned i = 0; i < state->count; ++i)
        if (state->pool[i] == 20) ++d20_count;
    int length;
    if (!state->has_result) {
        length = snprintf(buf + offset, capacity - offset, "%s | TAP ROLL", mode);
    } else if (state->mode != DICE_NORMAL && d20_count > 1) {
        // Separate attack/check rolls must not be presented as a single D20 total.
        length = snprintf(buf + offset, capacity - offset,
                          "%s | %u D20 TESTS: SEE DICE", mode, d20_count);
    } else {
        length = snprintf(buf + offset, capacity - offset, "%s | TOTAL %ld",
                          mode, (long)state->total);
    }
    return length >= 0 && (size_t)length < capacity - offset;
}
