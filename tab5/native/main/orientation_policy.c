#include "orientation_policy.h"
#include <math.h>

void orientation_policy_init(orientation_policy_t *state, int initial) {
    if (!state) return;
    state->current = initial >= 0 && initial <= 3 ? initial : 2;
    state->candidate = state->current;
    state->consistent_samples = 0;
}
bool orientation_policy_sample(orientation_policy_t *state,
                               float x, float y, float z, int *rotation) {
    if (!state || !rotation || !isfinite(x) || !isfinite(y) || !isfinite(z))
        return false;
    const float ax = fabsf(x), ay = fabsf(y), az = fabsf(z);
    // Ignore flat tables, nearly diagonal stands, and transient shaking.
    // The Espressif sensor hub reports acceleration in units of g.
    if (az > .67f || fmaxf(ax, ay) < .73f || fabsf(ax - ay) < .18f) {
        state->candidate = state->current;
        state->consistent_samples = 0;
        return false;
    }
    // Preserve existing Tab5-to-display axis mapping pending physical calibration.
    const int next = ay > ax ? (y < 0 ? 2 : 0) : (x < 0 ? 3 : 1);
    if (next == state->current) {
        state->candidate = next;
        state->consistent_samples = 0;
        return false;
    }
    if (state->candidate != next) {
        state->candidate = next;
        state->consistent_samples = 1;
        return false;
    }
    if (++state->consistent_samples < 6) return false;
    // Commit only after six consistent upright samples (~900 ms).
    state->current = next;
    state->consistent_samples = 0;
    *rotation = next;
    return true;
}
