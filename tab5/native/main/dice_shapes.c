#include "dice_shapes.h"
#include "dice_face_values.h"
#include "dice_mesh.h"
#include "dice_mesh_painter.h"
#include "dice_project.h"
#include "dice_silhouette.h"
#include "esp_log.h"
#include <string.h>

#define SHAPE_SLOTS 64
typedef struct {
    lv_obj_t *owner;
    uint8_t sides;
    bool discarded, mesh, percentile_tens;
    int pitch, yaw, roll, front_pitch, front_yaw;
    char face_text[20][4]; // Persistent through LVGL asynchronous draw.
} die_shape_state_t;
static die_shape_state_t slots[SHAPE_SLOTS];
static const char *TAG = "dice_shapes";

static void on_draw(lv_event_t *event) {
    const die_shape_state_t *state = lv_event_get_user_data(event);
    lv_layer_t *layer = lv_event_get_layer(event);
    lv_obj_t *object = lv_event_get_target(event);
    if (!state || state->owner != object || !layer) return;
    lv_area_t area;
    lv_obj_get_coords(object, &area);

    // Each d100 result owns TWO independent widgets with full-size d10
    // solids: first a tens die (00...90), then a units die (0...9).
    const uint8_t geometry = state->sides == 100 ? 10 : state->sides;
    if (state->mesh &&
        dice_mesh_paint(layer, &area, geometry, state->discarded,
                        state->front_pitch + state->pitch,
                        state->front_yaw + state->yaw,
                        state->roll, state->face_text)) return;

    dice_silhouette_draw(layer, &area, geometry, state->discarded);
    if (state->sides == 100)
        dice_mesh_paint_fallback_number(layer, &area, state->face_text[0]);
}
static void on_delete(lv_event_t *event) {
    die_shape_state_t *state = lv_event_get_user_data(event);
    if (state) memset(state, 0, sizeof(*state));
}
bool dice_shapes_attach(lv_obj_t *object, uint8_t sides,
                        uint16_t outcome, bool discarded,
                        bool percentile_tens) {
    if (!object) return false;
    const uint8_t geometry = sides == 100 ? 10 : sides;
    dice_mesh_t mesh;
    if (!dice_mesh_make(geometry, &mesh)) {
        ESP_LOGE(TAG, "Missing polygonal geometry: d%u", (unsigned)sides);
        return false;
    }
    for (unsigned i = 0; i < SHAPE_SLOTS; ++i) {
        die_shape_state_t *state = &slots[i];
        if (state->owner) continue;
        *state = (die_shape_state_t){
            .owner = object, .sides = sides, .discarded = discarded,
            .percentile_tens = percentile_tens
        };
        if (!dice_mesh_front_angles(&mesh, 0, &state->front_pitch,
                                   &state->front_yaw)) {
            ESP_LOGE(TAG, "Could not orient face for d%u", (unsigned)sides);
            memset(state, 0, sizeof(*state));
            return false;
        }
        for (unsigned f = 0; f < mesh.faces_count; ++f) {
            if (!dice_face_text(sides, outcome, (uint8_t)f, 0,
                                percentile_tens, state->face_text[f],
                                sizeof(state->face_text[f]))) {
                ESP_LOGE(TAG, "Invalid face mapping: d%u", (unsigned)sides);
                memset(state, 0, sizeof(*state));
                return false;
            }
        }
        lv_obj_add_event_cb(object, on_draw, LV_EVENT_DRAW_MAIN, state);
        lv_obj_add_event_cb(object, on_delete, LV_EVENT_DELETE, state);
        return true;
    }
    ESP_LOGE(TAG, "No LVGL die shape slots remain");
    return false;
}
void dice_shapes_set_tumble(lv_obj_t *object, bool enabled,
                            int pitch, int yaw, int roll) {
    if (!object) return;
    for (unsigned i = 0; i < SHAPE_SLOTS; ++i) {
        die_shape_state_t *state = &slots[i];
        if (state->owner != object) continue;
        state->mesh = enabled;
        state->pitch = pitch;
        state->yaw = yaw;
        state->roll = roll;
        lv_obj_invalidate(object);
        return;
    }
}
bool dice_shapes_has_embedded_numbers(lv_obj_t *object) {
    if (!object) return false;
    for (unsigned i = 0; i < SHAPE_SLOTS; ++i)
        if (slots[i].owner == object)
            return slots[i].mesh || slots[i].sides == 100;
    return false;
}
