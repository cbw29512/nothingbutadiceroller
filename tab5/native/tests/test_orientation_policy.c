#include "../main/orientation_policy.h"
#include <assert.h>
#include <stdio.h>
#include <math.h>

static void expect_stable(orientation_policy_t *s, float x, float y, float z,
                          int expected) {
    int chosen = -1;
    for (int i = 0; i < 5; ++i)
        assert(!orientation_policy_sample(s, x, y, z, &chosen));
    assert(chosen == -1);
    assert(orientation_policy_sample(s, x, y, z, &chosen));
    assert(chosen == expected && s->current == expected);
}
int main(void) {
    orientation_policy_t s;
    orientation_policy_init(&s, 2);
    assert(s.current == 2);
    int angle = -1;
    // A slightly tilted stand must stay readable, not be treated as flat.
    expect_stable(&s, 0.08f, 0.88f, .47f, 0);
    assert(!orientation_policy_sample(&s, 0, .98f, .02f, &angle));
    // Vibration, shaking and nearly diagonal readings never flip the screen.
    for (int i = 0; i < 100; ++i) {
        assert(!orientation_policy_sample(&s,
                 i % 2 ? -.88f : .88f, .1f, .2f, &angle));
    }
    assert(s.current == 0);
    for (int i = 0; i < 40; ++i) {
        assert(!orientation_policy_sample(&s, .04f, -.22f, .98f, &angle));
    }
    assert(s.current == 0);
    assert(!orientation_policy_sample(&s, NAN, .9f, .2f, &angle));
    // Upright portrait and reversed orientations require sustained gravity.
    expect_stable(&s, 0, -.94f, .2f, 2);
    expect_stable(&s, .98f, 0, .1f, 1);
    expect_stable(&s, -.98f, 0, .1f, 3);
    // A short transient should never change the last stable stand rotation.
    for (int i = 0; i < 3; ++i)
        assert(!orientation_policy_sample(&s, .01f, .99f, 0, &angle));
    assert(!orientation_policy_sample(&s, 0, 0, 1, &angle));
    assert(s.current == 3);
    puts("Tab5 stable stand rotation, gravity and jitter tests passed");
    return 0;
}
