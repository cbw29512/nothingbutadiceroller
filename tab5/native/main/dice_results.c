#include "dice_results.h"

static bool uses_pair(const dice_state_t *state, int i) {
    return state->mode != DICE_NORMAL && state->pool[i] == 20;
}

size_t dice_result_visible_count(const dice_state_t *state) {
    if (!state || !state->has_result || state->count > DICE_MAX) return 0;
    size_t n = state->count;
    for (int i = 0; i < state->count; ++i)
        if (uses_pair(state, i)) ++n;
    return n;
}

bool dice_result_visible_at(const dice_state_t *state, size_t visible_index,
                            dice_visible_face_t *out) {
    if (!state || !out || visible_index >= dice_result_visible_count(state))
        return false;
    size_t cursor = 0;
    for (int i = 0; i < state->count; ++i) {
        const bool pair = uses_pair(state, i);
        const size_t slots = pair ? 2 : 1;
        if (visible_index >= cursor + slots) {
            cursor += slots;
            continue;
        }
        const bool secondary = visible_index != cursor;
        const uint16_t a = state->faces[i];
        const uint16_t b = state->second_faces[i];
        if (!a || a > state->pool[i] || (pair && (!b || b > 20))) return false;
        const bool out_a = pair && (state->mode == DICE_ADV ? a < b : a > b);
        const bool out_b = pair && (state->mode == DICE_ADV ? b < a : b > a);
        *out = (dice_visible_face_t){
            .sides = state->pool[i],
            .face = secondary ? b : a,
            .selected_index = (uint8_t)i,
            .secondary = secondary,
            .discarded = secondary ? out_b : out_a
        };
        return true;
    }
    return false;
}
