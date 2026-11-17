#include "dice_motion.h"
#include <math.h>
#include <string.h>

static uint32_t next(uint32_t *seed) {
    *seed ^= *seed << 13; *seed ^= *seed >> 17; *seed ^= *seed << 5;
    return *seed;
}
static float random_unit(uint32_t *seed) {
    return (float)(next(seed) % 10000u) / 10000.0f;
}
static float clamp(float value, float lo, float hi) {
    return value < lo ? lo : value > hi ? hi : value;
}
static int scene_height(const dice_layout_t *layout) {
    const int rows = (layout->count + layout->columns - 1) / layout->columns;
    const int used = rows * layout->size + (rows - 1) * layout->gap + 12;
    return used > layout->height ? used : layout->height;
}
bool dice_motion_begin(dice_motion_t *scene, const dice_layout_t *layout,
                       uint32_t seed) {
    if (!scene || !layout || layout->count < 1 ||
        layout->count > DICE_MOTION_MAX || layout->columns < 1 ||
        layout->size < 40 || layout->width <= layout->size) return false;
    memset(scene, 0, sizeof(*scene));
    scene->count = layout->count;
    scene->width = layout->width;
    scene->height = scene_height(layout);
    scene->size = layout->size;
    if (!seed) seed = 0xACE5C123u;
    const float max_x = (float)(scene->width - scene->size - 3);
    const float max_y = (float)(scene->height - scene->size - 3);
    for (int i = 0; i < scene->count; ++i) {
        dice_motion_body_t *b = &scene->bodies[i];
        int x, y; dice_layout_position(layout, i, &x, &y);
        b->home_x = (float)x; b->home_y = (float)y;
        // Different launch angles and stagger avoid mechanical parallel bouncing.
        const float spread = (random_unit(&seed) - .5f) * scene->size * .65f;
        b->x = clamp(b->home_x + spread, 2, max_x);
        b->y = clamp(b->home_y - 16 - random_unit(&seed) * 50, 2, max_y);
        b->vx = (random_unit(&seed) - .5f) * 25.0f;
        b->vy = -3.0f - random_unit(&seed) * 8.0f;
        b->angle = random_unit(&seed) * 3600.0f;
        b->spin = (random_unit(&seed) - .5f) * 300.0f;
        b->pitch = random_unit(&seed) * 3600.0f;
        b->yaw = random_unit(&seed) * 3600.0f;
        b->pitch_speed = (random_unit(&seed) - .5f) * 240.0f;
        b->yaw_speed = (random_unit(&seed) - .5f) * 240.0f;
    }
    return true;
}
static void walls(dice_motion_t *scene, dice_motion_body_t *b) {
    const float max_x = (float)(scene->width - scene->size - 3);
    const float max_y = (float)(scene->height - scene->size - 3);
    if (b->x < 2 || b->x > max_x) {
        if (fabsf(b->vx) > 2.0f) scene->impacts++;
        b->x = clamp(b->x, 2, max_x);
        b->vx *= -.63f; b->spin *= .82f;
    }
    if (b->y < 2 || b->y > max_y) {
        if (fabsf(b->vy) > 2.0f) scene->impacts++;
        b->y = clamp(b->y, 2, max_y);
        b->vy *= -.51f;
        b->vx *= .79f; b->spin *= .76f;
    }
}
static void collide(dice_motion_t *scene) {
    // Approximate round-die contact: equal mass, impulse + positional correction.
    const float diameter = scene->size * .83f;
    for (int i = 0; i < scene->count; ++i) for (int j = i + 1; j < scene->count; ++j) {
        dice_motion_body_t *a = &scene->bodies[i], *b = &scene->bodies[j];
        const float dx = b->x - a->x, dy = b->y - a->y;
        const float dist2 = dx * dx + dy * dy;
        if (dist2 >= diameter * diameter) continue;
        const float dist = dist2 > 1 ? sqrtf(dist2) : 1.0f;
        const float nx = dist2 > 1 ? dx / dist : 1.0f;
        const float ny = dist2 > 1 ? dy / dist : 0.0f;
        const float correction = (diameter - dist) * .5f;
        a->x -= nx * correction; a->y -= ny * correction;
        b->x += nx * correction; b->y += ny * correction;
        const float relative = (b->vx - a->vx) * nx + (b->vy - a->vy) * ny;
        if (relative < 0) {
            if (relative < -2.0f) scene->impacts++;
            const float impulse = relative * -.72f;
            a->vx -= impulse * nx; a->vy -= impulse * ny;
            b->vx += impulse * nx; b->vy += impulse * ny;
            a->spin += relative * 4.0f; b->spin -= relative * 4.0f;
            a->pitch_speed += relative * 1.2f;
            b->yaw_speed -= relative * 1.2f;
        }
        walls(scene, a); walls(scene, b);
    }
}
bool dice_motion_step(dice_motion_t *scene) {
    if (!scene || scene->count < 1 || scene->count > DICE_MOTION_MAX ||
        scene->frame >= DICE_MOTION_FRAMES) return false;
    const int frame = ++scene->frame;
    scene->impacts = 0;
    for (int i = 0; i < scene->count; ++i) {
        dice_motion_body_t *b = &scene->bodies[i];
        if (frame <= 49) {
            b->x += b->vx; b->y += b->vy;
            b->vy = (b->vy + 1.1f) * .986f;
            b->vx *= .983f;
            b->spin *= .963f;
            b->angle = fmodf(b->angle + b->spin + 36000.0f, 3600.0f);
            b->pitch = fmodf(b->pitch + b->pitch_speed + 36000.0f, 3600.0f);
            b->yaw = fmodf(b->yaw + b->yaw_speed + 36000.0f, 3600.0f);
            b->pitch_speed *= .986f;
            b->yaw_speed *= .986f;
            walls(scene, b);
        } else {
            // An eased, readable landing grid avoids overlapping final faces.
            b->x += (b->home_x - b->x) * .31f;
            b->y += (b->home_y - b->y) * .31f;
            b->angle *= .72f;
            if(b->pitch > 1800.0f)b->pitch -= 3600.0f;
            if(b->yaw > 1800.0f)b->yaw -= 3600.0f;
            b->pitch *= .69f;b->yaw *= .69f;
        }
    }
    if (frame <= 49) collide(scene);
    if (frame >= DICE_MOTION_FRAMES) {
        for (int i = 0; i < scene->count; ++i) {
            dice_motion_body_t *b = &scene->bodies[i];
            b->x = b->home_x; b->y = b->home_y; b->angle = 0;
            b->pitch = 0; b->yaw = 0;
        }
    }
    return frame < DICE_MOTION_FRAMES;
}
void dice_motion_resize(dice_motion_t *scene, const dice_layout_t *layout) {
    if (!scene || !layout || scene->count != layout->count ||
        layout->columns < 1 || layout->size < 40) return;
    scene->width = layout->width;
    scene->height = scene_height(layout);
    scene->size = layout->size;
    for (int i = 0; i < scene->count; ++i) {
        int x, y; dice_layout_position(layout, i, &x, &y);
        dice_motion_body_t *b = &scene->bodies[i];
        b->home_x = (float)x; b->home_y = (float)y;
        b->x = clamp(b->x, 2, (float)(scene->width - scene->size - 3));
        b->y = clamp(b->y, 2, (float)(scene->height - scene->size - 3));
    }
}
