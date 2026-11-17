#include "dice_face_values.h"
#include <stdio.h>

bool dice_face_text(uint8_t sides, uint16_t result, uint8_t face_index,
                    uint8_t front_index, bool percentile_tens,
                    char *buffer, size_t capacity) {
    if (!buffer || capacity < 4) return false;
    buffer[0] = '\0';
    if (sides != 4 && sides != 6 && sides != 8 && sides != 10 &&
        sides != 12 && sides != 20 && sides != 100) return false;
    if (!result || result > sides || face_index >= (sides == 100 ? 10 : sides) ||
        front_index >= (sides == 100 ? 10 : sides)) return false;

    const unsigned count = sides == 100 ? 10u : (unsigned)sides;
    const unsigned offset = (face_index + count - front_index) % count;
    unsigned value;
    int written;
    if (sides == 100) {
        // A 100 roll is 00+0. The footer still interprets this as 100.
        const unsigned digit = result == 100 ? 0u :
                               percentile_tens ? (result / 10u) % 10u :
                                                 result % 10u;
        value = (digit + offset) % 10u;
        written = percentile_tens
                  ? snprintf(buffer, capacity, "%02u", value * 10u)
                  : snprintf(buffer, capacity, "%u", value);
    } else if (sides == 10) {
        // A ten-sided die is marked 0..9; 0 represents a result of 10.
        value = (result % 10u + offset) % 10u;
        written = snprintf(buffer, capacity, "%u", value);
    } else {
        value = (result - 1u + offset) % count + 1u;
        written = snprintf(buffer, capacity, "%u", value);
    }
    return written > 0 && (size_t)written < capacity;
}
