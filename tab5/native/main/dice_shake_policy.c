#include "dice_shake_policy.h"
#include <math.h>
#include <string.h>

void dice_shake_policy_init(dice_shake_policy_t *policy) {
    if (policy) memset(policy, 0, sizeof(*policy));
}
bool dice_shake_policy_sample(dice_shake_policy_t *p,
                              float x, float y, float z, uint32_t now_ms) {
    if (!p || !isfinite(x) || !isfinite(y) || !isfinite(z)) return false;

    const float g2 = x*x + y*y + z*z;
    // Ordinary tilts/rotations stay near 1g and cannot count as shaking.
    const bool calm = g2 >= .65f && g2 <= 1.45f;
    const bool impulse = g2 >= 2.80f || g2 <= .18f;

    // Five quiet observations arm the detector after boot or a prior roll.
    // Sustained jolts never arm or count as multiple discrete impulses.
    if (!p->armed) {
        p->calm_samples = calm ? (p->calm_samples < 5 ?
                                   p->calm_samples + 1 : 5) : 0;
        if (p->calm_samples >= 5) {
            p->armed = true;
            p->peaks = 0;
            p->peak_latched = false;
        }
        return false;
    }
    if (p->has_triggered && (uint32_t)(now_ms - p->last_trigger_ms) < 3000u)
        return false;
    if (p->peaks && (uint32_t)(now_ms - p->window_ms) > 1500u) {
        p->peaks = 0;
        p->peak_latched = false;
    }
    if (calm) p->peak_latched = false;
    if (!impulse || p->peak_latched) return false;

    p->peak_latched = true;
    if (!p->peaks) p->window_ms = now_ms;
    ++p->peaks;
    if (p->peaks < 3) return false;

    // All three pulses must arrive within one deliberate 1.5-second gesture.
    p->armed = false;
    p->calm_samples = 0;
    p->peaks = 0;
    p->last_trigger_ms = now_ms;
    p->has_triggered = true;
    return true;
}
