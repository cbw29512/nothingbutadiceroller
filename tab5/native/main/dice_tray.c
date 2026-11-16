#include "dice_tray.h"
#include "dice_layout.h"
#include "dice_motion.h"
#include "dice_results.h"
#include "dice_visuals.h"
#include "esp_log.h"
#include "esp_random.h"
#include <string.h>

static const char *TAG = "dice_tray";
static lv_obj_t *tray;
static lv_obj_t *dice[DICE_VISIBLE_MAX];
static lv_timer_t *timer;
static int count;
static dice_layout_t layout;
static dice_motion_t motion;

void dice_tray_bind(lv_obj_t *parent) {
    dice_tray_release();
    tray = parent;
}
void dice_tray_clear(void) {
    if (timer) { lv_timer_delete(timer); timer = NULL; }
    if (tray) lv_obj_clean(tray);
    memset(dice, 0, sizeof(dice));
    memset(&motion, 0, sizeof(motion));
    count = 0;
}
void dice_tray_release(void) {
    if (timer) { lv_timer_delete(timer); timer = NULL; }
    tray = NULL;
    memset(dice, 0, sizeof(dice));
    memset(&motion, 0, sizeof(motion));
    count = 0;
}
static void apply_positions(bool finished) {
    for (int i = 0; i < count; ++i) {
        if (!dice[i]) continue;
        const dice_motion_body_t *b = &motion.bodies[i];
        lv_obj_set_pos(dice[i], (int)b->x, (int)b->y);
        // LVGL rotating many large widgets costs memory; only animate small pools.
        if (count <= 12)
            lv_obj_set_style_transform_rotation(dice[i],
                finished ? 0 : (int)b->angle, 0);
        dice_visual_set_rolling(dice[i], !finished);
    }
}
void dice_tray_relayout(void) {
    if (!tray) return;
    layout = dice_layout_make(count, lv_obj_get_width(tray), lv_obj_get_height(tray));
    if (motion.count == count && count) dice_motion_resize(&motion, &layout);
    for (int i = 0; i < count; ++i) {
        if (dice[i]) lv_obj_set_size(dice[i], layout.size, layout.size);
    }
    if (count && !timer) apply_positions(true);
}
static void animate(lv_timer_t *event) {
    (void)event;
    if (!tray || !count) return;
    const bool moving = dice_motion_step(&motion);
    apply_positions(!moving);
    if (!moving) {
        lv_timer_delete(timer);
        timer = NULL;
    }
}
void dice_tray_render(const dice_state_t *state) {
    if (!tray || !state || !state->has_result) {
        ESP_LOGE(TAG, "Cannot render missing dice result or tray");
        return;
    }
    dice_tray_clear();
    count = (int)dice_result_visible_count(state);
    if (count < 1 || count > DICE_VISIBLE_MAX) {
        ESP_LOGE(TAG, "Invalid visible dice count %d", count);
        count = 0; return;
    }
    layout = dice_layout_make(count, lv_obj_get_width(tray), lv_obj_get_height(tray));
    // ESP hardware RNG supplies a throw trajectory only, NOT the rolled faces.
    if (!dice_motion_begin(&motion, &layout, esp_random())) {
        ESP_LOGE(TAG, "Could not prepare visual dice roll");
        count = 0; return;
    }
    for (int i = 0; i < count; ++i) {
        dice_visible_face_t face;
        if (!dice_result_visible_at(state, (size_t)i, &face)) {
            ESP_LOGE(TAG, "Invalid result face at index %d", i);
            dice_tray_clear(); return;
        }
        dice[i] = dice_visual_create(tray, face.sides, face.face,
                                     layout.size, face.discarded);
        if (!dice[i]) {
            ESP_LOGE(TAG, "Die %d could not be allocated", i);
            dice_tray_clear(); return;
        }
    }
    apply_positions(false);
    lv_obj_scroll_to_y(tray, 0, LV_ANIM_OFF);
    timer = lv_timer_create(animate, 33, NULL);
    if (!timer) {
        ESP_LOGW(TAG, "No animation timer; showing valid static dice");
        while (dice_motion_step(&motion)) { /* Present final verified result. */ }
        apply_positions(true);
    }
}
