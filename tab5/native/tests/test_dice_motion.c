#include "../main/dice_motion.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static void check_toss(int count, int w, int h, uint32_t seed) {
    dice_layout_t layout = dice_layout_make(count, w, h);
    dice_motion_t scene;
    assert(dice_motion_begin(&scene, &layout, seed));
    assert(scene.count == count && scene.frame == 0);
    float first_x = scene.bodies[0].x, first_y = scene.bodies[0].y;
    int steps = 0;
    while (dice_motion_step(&scene)) {
        assert(++steps < DICE_MOTION_FRAMES);
        for (int i = 0; i < scene.count; ++i) {
            const dice_motion_body_t *b = &scene.bodies[i];
            assert(isfinite(b->x) && isfinite(b->y) && isfinite(b->angle));
            assert(b->x >= 0 && b->y >= 0);
        }
    }
    assert(scene.frame == DICE_MOTION_FRAMES);
    assert(!dice_motion_step(&scene));
    if (count <= 2)
        assert(scene.bodies[0].x != first_x || scene.bodies[0].y != first_y);
    // Landing must restore legibility even for a crowded 32-die pool.
    for (int i = 0; i < scene.count; ++i) {
        int x, y; dice_layout_position(&layout, i, &x, &y);
        assert(scene.bodies[i].x == x && scene.bodies[i].y == y);
        assert(scene.bodies[i].angle == 0);
        for (int j = 0; j < i; ++j) {
            const dice_motion_body_t *a = &scene.bodies[i];
            const dice_motion_body_t *b = &scene.bodies[j];
            assert(a->x + layout.size <= b->x ||
                   b->x + layout.size <= a->x ||
                   a->y + layout.size <= b->y ||
                   b->y + layout.size <= a->y);
        }
    }
}
int main(void) {
    dice_motion_t empty;
    assert(!dice_motion_begin(&empty, NULL, 42));
    dice_layout_t invalid = dice_layout_make(0, 1200, 390);
    assert(!dice_motion_begin(&empty, &invalid, 42));
    check_toss(1, 1230, 385, 1729);
    check_toss(2, 1230, 385, 1729);
    check_toss(8, 1230, 385, 1729);
    check_toss(32, 1230, 385, 1729);
    check_toss(33, 680, 878, 1729);
    // At maximum physical percentile capacity the animation remains bounded.
    check_toss(64, 1230, 385, 1729);
    check_toss(64, 680, 878, 1729);
    // Same visual seed means reproducible motion for host debugging.
    dice_layout_t layout = dice_layout_make(4, 1200, 380);
    dice_motion_t a, b;
    assert(dice_motion_begin(&a, &layout, 1123));
    assert(dice_motion_begin(&b, &layout, 1123));
    assert(memcmp(&a, &b, sizeof(a)) == 0);
    assert(dice_motion_step(&a) && dice_motion_step(&b));
    assert(memcmp(&a, &b, sizeof(a)) == 0);
    // Rotation during a roll preserves the presentation frame and the faces
    // because the motion module never owns or modifies the dice engine.
    dice_layout_t portrait = dice_layout_make(4, 680, 860);
    const int before = a.frame;
    dice_motion_resize(&a, &portrait);
    assert(a.frame == before && a.width == portrait.width);
    while (dice_motion_step(&a)) {}
    assert(a.frame == DICE_MOTION_FRAMES);
    puts("Tab5 natural motion, collisions, landing and rotation tests passed");
    return 0;
}
