#include "dice_tray.h"
#include "dice_layout.h"
#include "dice_visuals.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "dice_tray";
static lv_obj_t *tray;
static lv_obj_t *dice[DICE_MAX + 1];
static lv_timer_t *timer;
static int16_t pos_x[DICE_MAX + 1], pos_y[DICE_MAX + 1];
static int16_t vel_x[DICE_MAX + 1], vel_y[DICE_MAX + 1];
static int count, ticks;
static dice_layout_t layout;

void dice_tray_bind(lv_obj_t *parent) {
    dice_tray_release();
    tray = parent;
}

void dice_tray_clear(void) {
    if (timer) { lv_timer_delete(timer); timer = NULL; }
    if (tray) lv_obj_clean(tray);
    memset(dice, 0, sizeof(dice));
    count = 0;
    ticks = 0;
}

void dice_tray_release(void) {
    if (timer) { lv_timer_delete(timer); timer = NULL; }
    tray = NULL;
    memset(dice, 0, sizeof(dice));
    count = 0;
}

static void settle(void) {
    if (!tray) return;
    layout = dice_layout_make(count, lv_obj_get_width(tray), lv_obj_get_height(tray));
    for (int i = 0; i < count; ++i) {
        if (!dice[i]) continue;
        int x, y;
        dice_layout_position(&layout, i, &x, &y);
        lv_obj_set_pos(dice[i], x, y);
    }
}

void dice_tray_relayout(void) {
    if (!tray) return;
    layout = dice_layout_make(count, lv_obj_get_width(tray), lv_obj_get_height(tray));
    for (int i = 0; i < count; ++i) {
        if (dice[i]) lv_obj_set_size(dice[i], layout.size, layout.size);
    }
    if (!timer) settle();
}

static void animate(lv_timer_t *event) {
    (void)event;
    if (!tray) return;
    // Purely visual bounce. Random faces are already fixed by the engine.
    const int max_x = lv_obj_get_width(tray) - layout.size - 4;
    const int max_y = lv_obj_get_height(tray) - layout.size - 4;
    for (int i = 0; i < count; ++i) {
        if (!dice[i]) continue;
        pos_x[i] += vel_x[i];
        pos_y[i] += vel_y[i];
        vel_y[i] += 1;
        if (pos_x[i] < 2 || pos_x[i] > max_x) {
            vel_x[i] = -vel_x[i] * 2 / 3;
            pos_x[i] = pos_x[i] < 2 ? 2 : max_x;
        }
        if (pos_y[i] < 2) { pos_y[i] = 2; vel_y[i] = -vel_y[i] / 2; }
        if (pos_y[i] > max_y) {
            pos_y[i] = max_y;
            vel_y[i] = -vel_y[i] / 2;
            vel_x[i] = vel_x[i] * 3 / 4;
        }
        lv_obj_set_pos(dice[i], pos_x[i], pos_y[i]);
    }
    if (++ticks >= (count > 8 ? 28 : 45)) {
        lv_timer_delete(timer);
        timer = NULL;
        settle();
    }
}

void dice_tray_render(const dice_state_t *state) {
    if (!tray || !state || !state->has_result) {
        ESP_LOGE(TAG, "Cannot render missing dice result or tray");
        return;
    }
    dice_tray_clear();
    count = state->count + (state->mode != DICE_NORMAL ? 1 : 0);
    if (count < 1 || count > DICE_MAX + 1) {
        ESP_LOGE(TAG, "Invalid visible dice count %d", count);
        count = 0;
        return;
    }
    layout = dice_layout_make(count, lv_obj_get_width(tray), lv_obj_get_height(tray));
    for (int i = 0; i < count; ++i) {
        const uint8_t sides = i >= state->count ? 20 : state->pool[i];
        bool out = false;
        if (state->mode == DICE_ADV && i < 2)
            out = state->faces[i] < state->faces[1 - i];
        if (state->mode == DICE_DIS && i < 2)
            out = state->faces[i] > state->faces[1 - i];
        dice[i] = dice_visual_create(tray, sides, state->faces[i], layout.size, out);
        if (!dice[i]) {
            ESP_LOGE(TAG, "Die %d could not be allocated", i);
            dice_tray_clear();
            return;
        }
        int base_x, base_y;
        dice_layout_position(&layout, i, &base_x, &base_y);
        pos_x[i] = base_x;
        pos_y[i] = base_y > 28 ? base_y - 28 : base_y;
        vel_x[i] = (int16_t)(2 + i % 5);
        vel_y[i] = (int16_t)(-3 - i % 4);
        lv_obj_set_pos(dice[i], pos_x[i], pos_y[i]);
    }
    lv_obj_scroll_to_y(tray, 0, LV_ANIM_OFF);
    timer = lv_timer_create(animate, 33, NULL);
    if (!timer) {
        ESP_LOGW(TAG, "Animation timer allocation failed; showing final dice");
        settle();
    }
}
