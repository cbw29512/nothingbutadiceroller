#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// Logical face names are presentation only: the secure roll is immutable.
// d100 is a matched pair of d10s, not a 100-labeled ten-sided solid.
bool dice_face_text(uint8_t sides, uint16_t result, uint8_t face_index,
                    uint8_t front_index, bool percentile_tens,
                    char *buffer, size_t capacity);
