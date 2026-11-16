#include "dice_engine.h"
#include <limits.h>
#include <string.h>

void dice_state_reset(dice_state_t *s) {
    if (s) { memset(s, 0, sizeof(*s)); s->phase = DICE_CHOOSE; }
}
bool dice_select(dice_state_t *s, int system) {
    if (!s || s->phase != DICE_CHOOSE || system != 0) return false;
    s->selected_system = system;
    s->phase = DICE_CONFIRM;
    return true;
}
bool dice_confirm(dice_state_t *s) {
    if (!s || s->phase != DICE_CONFIRM) return false;
    s->phase = DICE_SESSION;
    return true;
}
bool dice_add(dice_state_t *s, uint8_t sides) {
    if (!s || s->phase != DICE_SESSION || s->count >= DICE_MAX) return false;
    switch (sides) {
        case 4: case 6: case 8: case 10: case 12: case 20: case 100: break;
        default: return false;
    }
    s->pool[s->count++] = sides;
    s->has_result = false;
    return true;
}
void dice_clear(dice_state_t *s) {
    if (!s || s->phase != DICE_SESSION) return;
    s->count = 0;
    s->modifier = 0;
    s->mode = DICE_NORMAL;
    s->has_result = false;
}
uint32_t dice_unbiased(uint32_t sides, dice_rng_t rng) {
    if (sides < 2 || !rng) return 0;
    // Reject the tail; % alone biases results unless 2^32 divides sides.
    const uint64_t range = UINT64_C(4294967296);
    const uint64_t limit = (range / sides) * sides;
    for (unsigned i = 0; i < 1000; i++) {
        uint32_t raw = rng();
        if ((uint64_t)raw < limit) return (raw % sides) + 1;
    }
    return 0; // Fail closed; never substitute a predictable face.
}
bool dice_roll(dice_state_t *s, dice_rng_t rng) {
    if (!s || s->phase != DICE_SESSION || !s->count || !rng) return false;
    // Resolve each selected die exactly once; ADV/DIS adds one d20 per test.
    // Never commit partially generated faces if entropy generation fails.
    uint16_t first[DICE_MAX] = {0};
    uint16_t second[DICE_MAX] = {0};
    int32_t total = s->modifier;
    for (int i = 0; i < s->count; ++i) {
        const uint8_t sides = s->pool[i];
        const uint32_t primary = dice_unbiased(sides, rng);
        if (!primary) return false;
        uint32_t chosen = primary;
        if (sides == 20 && s->mode != DICE_NORMAL) {
            const uint32_t secondary = dice_unbiased(20, rng);
            if (!secondary) return false;
            second[i] = (uint16_t)secondary;
            if (s->mode == DICE_ADV && secondary > chosen) chosen = secondary;
            if (s->mode == DICE_DIS && secondary < chosen) chosen = secondary;
        }
        if (total > INT32_MAX - (int32_t)chosen) return false;
        first[i] = (uint16_t)primary;
        total += (int32_t)chosen;
    }
    memcpy(s->faces, first, sizeof(first));
    memcpy(s->second_faces, second, sizeof(second));
    s->total = total;
    s->has_result = true;
    return true;
}
