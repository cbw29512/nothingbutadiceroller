#include "dice_shake_policy.h"
#include <math.h>
#include <string.h>

// Acceleration thresholds in g squared. These are intentionally softer
// than the previous 3-peak >1.67g detector; hardware needs calibration.
#define STILL_G2 0.12f
#define SWING_G2 0.25f
#define REVERSE_DOT (-0.14f)

void dice_shake_policy_init(dice_shake_policy_t *p) {
    if (p) memset(p, 0, sizeof(*p));
}
bool dice_shake_policy_sample(dice_shake_policy_t *p,
                              float x, float y, float z, uint32_t now_ms) {
    if (!p || !isfinite(x) || !isfinite(y) || !isfinite(z)) return false;
    if (!p->initialized) {
        p->gravity_x=x; p->gravity_y=y; p->gravity_z=z;
        p->initialized=true;
        return false;
    }
    const float dx=x-p->gravity_x, dy=y-p->gravity_y, dz=z-p->gravity_z;
    const float motion2=dx*dx+dy*dy+dz*dz;
    const float g2=x*x+y*y+z*z;
    const bool calm=motion2<STILL_G2 && g2>.58f && g2<1.55f;

    // Follow slow orientation changes while keeping sharp hand motions
    // distinct from gravity. During stillness follow a little faster.
    const float a=calm ? .12f : .025f;
    p->gravity_x+=dx*a; p->gravity_y+=dy*a; p->gravity_z+=dz*a;

    // Four quiet sensor events arm a fresh deliberate gesture.
    if (calm) {
        if (p->calm_samples<4) ++p->calm_samples;
    } else p->calm_samples=0;
    if (p->calm_samples>=4) p->armed=true;

    // Do not accept a second roll from the same physical shake.
    if (p->has_triggered && (uint32_t)(now_ms-p->last_trigger_ms)<1800u)
        return false;
    if (!p->armed) return false;

    // One hand shake consists of an outbound impulse and a reversal.
    if (p->waiting_reverse) {
        const uint32_t elapsed=(uint32_t)(now_ms-p->first_ms);
        if (elapsed>850u) p->waiting_reverse=false;
        else if (elapsed>=40u && motion2>=SWING_G2 &&
                 dx*p->impulse_x+dy*p->impulse_y+dz*p->impulse_z<REVERSE_DOT) {
            p->waiting_reverse=false;
            p->armed=false;
            p->calm_samples=0;
            p->last_trigger_ms=now_ms;
            p->has_triggered=true;
            return true;
        }
    }
    if (!p->waiting_reverse && motion2>=SWING_G2) {
        p->impulse_x=dx; p->impulse_y=dy; p->impulse_z=dz;
        p->first_ms=now_ms;
        p->waiting_reverse=true;
    }
    return false;
}
