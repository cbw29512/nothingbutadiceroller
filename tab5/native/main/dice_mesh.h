#pragma once
#include <stdbool.h>
#include <stdint.h>

// Pure polyhedron geometry. No LVGL, RNG, game results, or external assets.
#define DICE_MESH_MAX_VERTICES 20
#define DICE_MESH_MAX_FACES 20
#define DICE_MESH_MAX_CORNERS 5

typedef struct { float x, y, z; } dice_vec3_t;
typedef struct {
    uint8_t corners;
    uint8_t vertex[DICE_MESH_MAX_CORNERS];
} dice_mesh_face_t;
typedef struct {
    uint8_t vertices_count;
    uint8_t faces_count;
    dice_vec3_t vertices[DICE_MESH_MAX_VERTICES];
    dice_mesh_face_t faces[DICE_MESH_MAX_FACES];
} dice_mesh_t;

bool dice_mesh_make(uint8_t sides, dice_mesh_t *output);
