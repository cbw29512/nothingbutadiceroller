#include "dice_nat_event.h"
#include "dice_results.h"

dice_nat_event_t dice_nat_event_detect(const dice_state_t *state) {
    if (!state || !state->has_result || state->phase != DICE_SESSION)
        return DICE_NAT_NONE;

    bool has_one = false;
    bool has_twenty = false;
    const size_t count = dice_result_visible_count(state);

    // Reuse the existing visible-face mapping. It already knows which
    // ADV/DIS face was discarded, avoiding competing interpretations.
    for (size_t i = 0; i < count; ++i) {
        dice_visible_face_t face;
        if (!dice_result_visible_at(state, i, &face)) return DICE_NAT_NONE;
        if (face.sides != 20 || face.discarded) continue;
        if (face.face == 20) has_twenty = true;
        if (face.face == 1) has_one = true;
    }

    // If a selected multi-d20 pool contains both extremes, show NAT 20.
    // Neither visual event implies automatic success on checks or saves.
    if (has_twenty) return DICE_NAT_20;
    if (has_one) return DICE_NAT_1;
    return DICE_NAT_NONE;
}
