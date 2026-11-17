#pragma once
#include "dice_project.h"
#include <stdbool.h>

// Pure projected-face geometry: accepts a label only when its entire
// rectangle is contained within the die polygon, with a 2px edge margin.
// This is display geometry only and cannot affect RNG results.
bool dice_label_fits_face(const dice_project_face_t *face,
                          int center_x, int center_y,
                          int width, int height);
