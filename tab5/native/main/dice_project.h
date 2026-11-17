#pragma once
#include "dice_mesh.h"
#include <stdbool.h>
#include <stdint.h>

// Pure perspective projection; no LVGL. Units: angle in 0.1 degrees.
typedef struct {
    uint8_t corners;
    uint8_t source_index; // Original mesh face; stable through depth sorting.
    int16_t x[DICE_MESH_MAX_CORNERS];
    int16_t y[DICE_MESH_MAX_CORNERS];
    float depth;
    uint8_t shade;
} dice_project_face_t;
typedef struct {
    uint8_t count;
    dice_project_face_t faces[DICE_MESH_MAX_FACES];
} dice_projection_t;

// Rotate a source face to face the screen at settle, then assign its result.
bool dice_mesh_front_angles(const dice_mesh_t *mesh, uint8_t face_index,
                            int *pitch, int *yaw);

bool dice_project_mesh(const dice_mesh_t *mesh,
                       int pitch, int yaw, int roll, int size,
                       dice_projection_t *out);
