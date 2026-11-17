#include "dice_label_fit.h"
#include <stdint.h>

static bool point_inside_convex(const dice_project_face_t *face,
                                int x, int y) {
    int winding = 0;
    for (unsigned i = 0; i < face->corners; ++i) {
        const unsigned j = (i + 1) % face->corners;
        const int64_t dx = (int64_t)face->x[j] - face->x[i];
        const int64_t dy = (int64_t)face->y[j] - face->y[i];
        const int64_t px = (int64_t)x - face->x[i];
        const int64_t py = (int64_t)y - face->y[i];
        const int64_t cross = dx * py - dy * px;
        // A 2-pixel clearance stops glyph edges bleeding off angled
        // polygon faces, even during rotation and perspective changes.
        const int64_t margin = 2 * ((dx < 0 ? -dx : dx) +
                                    (dy < 0 ? -dy : dy));
        if (cross >= -margin && cross <= margin) return false;
        const int side = cross > 0 ? 1 : -1;
        if (winding && winding != side) return false;
        winding = side;
    }
    return winding != 0;
}

bool dice_label_fits_face(const dice_project_face_t *face,
                          int center_x, int center_y,
                          int width, int height) {
    if (!face || face->corners < 3 ||
        face->corners > DICE_MESH_MAX_CORNERS ||
        width < 1 || height < 1) return false;
    const int x0 = center_x - width / 2;
    const int y0 = center_y - height / 2;
    const int x1 = x0 + width;
    const int y1 = y0 + height;
    // Every corner inside a convex polygon implies the full label box
    // lies on the face. Unlike bounding-box checks this handles triangles,
    // diamonds and the narrow/kite-shaped d10 faces correctly.
    return point_inside_convex(face, x0, y0) &&
           point_inside_convex(face, x1, y0) &&
           point_inside_convex(face, x0, y1) &&
           point_inside_convex(face, x1, y1);
}
