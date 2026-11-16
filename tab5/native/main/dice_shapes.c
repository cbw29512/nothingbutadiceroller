#include "dice_shapes.h"
#include <stdint.h>

// Normalized silhouettes are recognizable tabletop polyhedra, not 3D meshes.
static const uint8_t d4[][2] = {{50,8},{91,88},{9,88}};
static const uint8_t d6[][2] = {{50,8},{90,27},{90,72},{50,94},{10,73},{10,27}};
static const uint8_t d8[][2] = {{50,5},{95,50},{50,95},{5,50}};
static const uint8_t d10[][2] = {{50,5},{83,17},{95,49},{76,80},{50,97},
                                {23,80},{5,49},{17,17}};
static const uint8_t d12[][2] = {{50,5},{76,12},{93,31},{96,57},{78,83},
                                {50,95},{22,83},{4,57},{7,31},{24,12}};
static const uint8_t d20[][2] = {{50,5},{89,23},{96,67},{71,91},
                                {29,91},{4,67},{11,23}};
typedef struct {
    const uint8_t (*p)[2];
    unsigned count;
    uint32_t light, mid, dark;
} shape_t;

static shape_t shape_for(uint8_t sides, bool discarded) {
    shape_t s = {d20, 7, 0xED6679, 0xBD3249, 0x7A2436};
    switch (sides) {
        case 4: s = (shape_t){d4, 3, 0xEAC06F, 0xB67932, 0x75501E}; break;
        case 6: s = (shape_t){d6, 6, 0x74C1E5, 0x347EB1, 0x204E79}; break;
        case 8: s = (shape_t){d8, 4, 0xB5A0E9, 0x7955B8, 0x493475}; break;
        case 10: s = (shape_t){d10, 8, 0x79CBA6, 0x358E71, 0x215C4A}; break;
        case 12: s = (shape_t){d12, 10, 0xE4A77C, 0xBC623B, 0x783823}; break;
        case 20: break;
        case 100: s = (shape_t){d10, 8, 0xE9CF79, 0xB78A35, 0x685226}; break;
        default: break;
    }
    if (discarded) {
        s.light = 0x81909A; s.mid = 0x52616D; s.dark = 0x35404B;
    }
    return s;
}

static lv_point_precise_t vertex(const lv_area_t *area, const uint8_t p[2],
                                  int dx, int dy) {
    lv_point_precise_t out = {
        .x = area->x1 + (lv_area_get_width(area) * p[0]) / 100 + dx,
        .y = area->y1 + (lv_area_get_height(area) * p[1]) / 100 + dy
    };
    return out;
}

static void triangle(lv_layer_t *layer, lv_point_precise_t a,
                     lv_point_precise_t b, lv_point_precise_t c, uint32_t color) {
    lv_draw_triangle_dsc_t desc;
    lv_draw_triangle_dsc_init(&desc);
    desc.p[0] = a; desc.p[1] = b; desc.p[2] = c;
    desc.color = lv_color_hex(color);
    desc.opa = LV_OPA_COVER;
    lv_draw_triangle(layer, &desc);
}

static void line(lv_layer_t *layer, lv_point_precise_t a,
                 lv_point_precise_t b, uint32_t color, int thickness) {
    lv_draw_line_dsc_t desc;
    lv_draw_line_dsc_init(&desc);
    desc.p1 = a; desc.p2 = b;
    desc.color = lv_color_hex(color);
    desc.opa = LV_OPA_COVER;
    desc.width = thickness;
    desc.round_start = true; desc.round_end = true;
    lv_draw_line(layer, &desc);
}

static void draw_dice(lv_event_t *e) {
    const uintptr_t code = (uintptr_t)lv_event_get_user_data(e);
    const uint8_t sides = (uint8_t)(code & 0xFF);
    const shape_t s = shape_for(sides, (code & 0x100) != 0);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_obj_t *obj = lv_event_get_target(e);
    if (!obj || !layer) return;
    lv_area_t area;
    lv_obj_get_coords(obj, &area);
    const uint8_t center[2] = {50,50};
    const lv_point_precise_t c = vertex(&area, center, 0, 0);
    const int thickness = lv_area_get_width(&area) > 165 ? 4 : 3;
    for (unsigned i = 0; i < s.count; ++i) {
        const unsigned next = (i + 1) % s.count;
        const lv_point_precise_t a = vertex(&area, s.p[i], 0, 0);
        const lv_point_precise_t b = vertex(&area, s.p[next], 0, 0);
        // Alternating facets mimic light falling on each visible face.
        triangle(layer, c, a, b, i % 3 == 0 ? s.light :
                                i % 3 == 1 ? s.mid : s.dark);
        line(layer, a, b, 0x151D2B, thickness);
        if (sides != 4 || (i & 1) == 0)
            line(layer, a, c, 0x233040, thickness > 3 ? 3 : 2);
    }
}

void dice_shapes_attach(lv_obj_t *object, uint8_t sides, bool discarded) {
    if (!object) return;
    const uintptr_t code = (uintptr_t)sides | (discarded ? 0x100u : 0);
    lv_obj_add_event_cb(object, draw_dice, LV_EVENT_DRAW_MAIN, (void *)code);
}
