#include "../main/dice_shake_policy.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static void arm(dice_shake_policy_t *s, uint32_t *ms) {
    for (int i=0; i<5; ++i) {
        *ms += 100;
        assert(!dice_shake_policy_sample(s, 0, 0, 1, *ms));
    }
}
static void pulse(dice_shake_policy_t *s, uint32_t *ms,
                  bool should_trigger) {
    *ms += 100;
    assert(dice_shake_policy_sample(s, 0, 0, 2.0f, *ms) == should_trigger);
    *ms += 100;
    assert(!dice_shake_policy_sample(s, 0, 0, 1.0f, *ms));
}
int main(void) {
    dice_shake_policy_t s;
    dice_shake_policy_init(&s);
    uint32_t ms=0;
    assert(!dice_shake_policy_sample(NULL, 0, 0, 1, ms));
    assert(!dice_shake_policy_sample(&s, NAN, 0, 1, ms));
    arm(&s, &ms);
    // Turning or tilting a tablet isn't three violent impulses.
    for (int i=0; i<50; ++i) {
        ms += 100;
        assert(!dice_shake_policy_sample(&s,
                  (i%2 ? .9f : -.9f), .1f, .3f, ms));
    }
    // A single bump/held high-g is not enough.
    ms += 100;
    assert(!dice_shake_policy_sample(&s, 0, 0, 2, ms));
    for (int i=0; i<6; ++i) {
        ms += 100;
        assert(!dice_shake_policy_sample(&s, 0, 0, 2, ms));
    }
    ms += 100;
    assert(!dice_shake_policy_sample(&s, 0, 0, 1, ms));
    pulse(&s, &ms, false); // second distinct impulse
    pulse(&s, &ms, true);  // third distinct impulse, one roll
    // Holding a shake cannot trigger twice.
    for (int i=0; i<35; ++i) {
        ms += 100;
        assert(!dice_shake_policy_sample(&s, 0, 0, 2, ms));
    }
    arm(&s, &ms);
    pulse(&s, &ms, false);
    pulse(&s, &ms, false);
    pulse(&s, &ms, true);
    // Slow isolated bumps expire without a roll.
    dice_shake_policy_init(&s);
    arm(&s, &ms);
    pulse(&s, &ms, false);
    ms += 1700;
    pulse(&s, &ms, false);
    pulse(&s, &ms, false);
    assert(s.peaks == 2);
    puts("Tab5 intentional three-impulse shake and cooldown policy passed");
    return 0;
}
