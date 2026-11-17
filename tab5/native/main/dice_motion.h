#pragma once
#include "dice_layout.h"
#include <stdbool.h>
#include <stdint.h>

#define DICE_MOTION_MAX 64
#define DICE_MOTION_FRAMES 72

// Presentation-only state. No game faces, totals, or RNG engine pointers.
typedef struct {
    float x, y, vx, vy;
    float angle, spin;
    float pitch, yaw, pitch_speed, yaw_speed; // 3D presentation rotation only.
    float home_x, home_y;
} dice_motion_body_t;
typedef struct {
    dice_motion_body_t bodies[DICE_MOTION_MAX];
    int count, width, height, size, frame;
    unsigned impacts; // Count physical wall/die contacts this visual frame.
} dice_motion_t;

// seed is presentation entropy only; game outcomes are already final.
bool dice_motion_begin(dice_motion_t *scene, const dice_layout_t *layout,
                       uint32_t seed);
bool dice_motion_step(dice_motion_t *scene);
void dice_motion_resize(dice_motion_t *scene, const dice_layout_t *layout);
