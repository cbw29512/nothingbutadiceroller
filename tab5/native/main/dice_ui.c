#include "dice_ui.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_random.h"
#include "lvgl.h"
#include <stdio.h>
#include <string.h>

static const char *TAG = "dice_ui";
static dice_state_t *g_state;
static lv_obj_t *g_screen, *g_tray, *g_summary, *g_dice[DICE_MAX + 1];
static lv_timer_t *g_motion;
static int16_t x[DICE_MAX + 1], y[DICE_MAX + 1], vx[DICE_MAX + 1], vy[DICE_MAX + 1];
static uint8_t display_count;
static unsigned frames;

static void show_choose(void);
static void show_confirm(void);
static void show_session(void);
static void roll_start(void);

static lv_obj_t *button(lv_obj_t *parent, const char *name, int w, int h,
                        lv_event_cb_t cb, intptr_t code) {
    lv_obj_t *b = lv_button_create(parent);
    lv_obj_set_size(b, w, h);
    lv_obj_set_style_bg_color(b, lv_color_hex(0x355679), 0);
    lv_obj_set_style_radius(b, 14, 0);
    lv_obj_add_event_cb(b, cb, LV_EVENT_CLICKED, (void *)code);
    lv_obj_t *label = lv_label_create(b);
    lv_label_set_text(label, name);
    lv_obj_center(label);
    return b;
}
static void clear_screen(void) {
    if (g_motion) { lv_timer_delete(g_motion); g_motion = NULL; }
    lv_obj_clean(g_screen);
    g_tray = NULL; g_summary = NULL;
    memset(g_dice, 0, sizeof(g_dice));
}
static void choose_event(lv_event_t *e) {
    (void)e;
    if (!dice_select(g_state, 0)) { ESP_LOGE(TAG, "Game system selection refused"); return; }
    show_confirm();
}
static void confirm_event(lv_event_t *e) {
    intptr_t yes = (intptr_t)lv_event_get_user_data(e);
    if (yes) {
        if (!dice_confirm(g_state)) { ESP_LOGE(TAG, "Session confirmation failed"); return; }
        show_session();
    } else {
        dice_state_reset(g_state);
        show_choose();
    }
}
static void show_choose(void) {
    clear_screen();
    lv_obj_t *title = lv_label_create(g_screen);
    lv_label_set_text(title, "CHOOSE YOUR DICE SYSTEM");
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 100);
    lv_obj_t *b = button(g_screen, "D&D 5e", 350, 120, choose_event, 0);
    lv_obj_align(b, LV_ALIGN_CENTER, 0, 0);
    lv_obj_t *hint = lv_label_create(g_screen);
    lv_label_set_text(hint, "Additional verified game profiles are coming.");
    lv_obj_align(hint, LV_ALIGN_BOTTOM_MID, 0, -100);
}
static void show_confirm(void) {
    clear_screen();
    lv_obj_t *label = lv_label_create(g_screen);
    lv_label_set_text(label, "START D&D 5e?\nLocked until device restart.");
    lv_obj_align(label, LV_ALIGN_CENTER, 0, -120);
    lv_obj_t *yes = button(g_screen, "START", 310, 115, confirm_event, 1);
    lv_obj_align(yes, LV_ALIGN_CENTER, 180, 30);
    lv_obj_t *no = button(g_screen, "CHANGE", 310, 115, confirm_event, 0);
    lv_obj_align(no, LV_ALIGN_CENTER, -180, 30);
}
static void update_summary(void) {
    if (!g_summary) return;
    char buf[256];
    if (!g_state->has_result) {
        snprintf(buf, sizeof(buf), "%u dice selected  |  Tap ROLL", g_state->count);
    } else if (g_state->mode != DICE_NORMAL) {
        snprintf(buf, sizeof(buf), "d20: %u, %u  (%s)  |  TOTAL %ld",
                 g_state->faces[0], g_state->faces[1],
                 g_state->mode == DICE_ADV ? "ADV" : "DIS",
                 (long)g_state->total);
    } else {
        snprintf(buf, sizeof(buf), "%u dice  |  TOTAL %ld", g_state->count,
                 (long)g_state->total);
    }
    lv_label_set_text(g_summary, buf);
}
static void motion_step(lv_timer_t *timer) {
    (void)timer;
    if (!g_tray) return;
    // Simple, bounded 2D presentation simulation; NOT finished 3D tumbling.
    for (int i = 0; i < display_count; i++) {
        if (!g_dice[i]) continue;
        x[i] += vx[i]; y[i] += vy[i]; vy[i] += 1;
        if (x[i] < 2 || x[i] > 1110) {
            vx[i] = -vx[i] * 2 / 3;
            x[i] = x[i] < 2 ? 2 : 1110;
        }
        if (y[i] > 290) {
            y[i] = 290;
            vy[i] = -vy[i] / 2;
            vx[i] = vx[i] * 3 / 4;
        }
        lv_obj_set_pos(g_dice[i], x[i], y[i]);
    }
    if (++frames >= 90) {
        // Deterministic grid makes every result inspectable after movement.
        for (int i = 0; i < display_count; i++)
            if (g_dice[i]) lv_obj_set_pos(g_dice[i], 10 + (i % 8) * 140,
                                                 12 + (i / 8) * 112);
        lv_timer_delete(g_motion);
        g_motion = NULL;
    }
}
static void roll_start(void) {
    if (!g_state->count) return;
    if (!dice_roll(g_state, esp_random)) {
        ESP_LOGE(TAG, "Secure roll failed; results unchanged");
        return;
    }
    if (g_motion) { lv_timer_delete(g_motion); g_motion = NULL; }
    lv_obj_clean(g_tray);
    display_count = g_state->count + (g_state->mode != DICE_NORMAL ? 1 : 0);
    frames = 0;
    for (int i = 0; i < display_count; i++) {
        uint16_t face = g_state->faces[i];
        uint8_t sides = i >= g_state->count ? 20 : g_state->pool[i];
        g_dice[i] = lv_obj_create(g_tray);
        lv_obj_set_size(g_dice[i], 100, 90);
        lv_obj_set_style_radius(g_dice[i], 16, 0);
        lv_obj_set_style_bg_color(g_dice[i], lv_color_hex(0xB43E42), 0);
        lv_obj_clear_flag(g_dice[i], LV_OBJ_FLAG_SCROLLABLE);
        char text[48];
        snprintf(text, sizeof(text), "d%u\n%u", sides, face);
        lv_obj_t *label = lv_label_create(g_dice[i]);
        lv_label_set_text(label, text);
        lv_obj_center(label);
        // Visual motion only: outcomes are already determined by RNG.
        x[i] = 100 + (i % 8) * 120;
        y[i] = 8 + (i / 8) * 20;
        vx[i] = (int16_t)(2 + i % 5);
        vy[i] = (int16_t)(-3 - i % 7);
        lv_obj_set_pos(g_dice[i], x[i], y[i]);
    }
    update_summary();
    g_motion = lv_timer_create(motion_step, 33, NULL);
}
static void action_event(lv_event_t *e) {
    intptr_t code = (intptr_t)lv_event_get_user_data(e);
    if (code == 0) dice_clear(g_state);
    else if (code == -1) { roll_start(); return; }
    else if (code == -2 || code == -3) {
        g_state->mode = code == -2 ? DICE_ADV : DICE_DIS;
        // ADV and DIS are d20-only controls in this basic version.
        g_state->count = 0;
        dice_add(g_state, 20);
    } else {
        g_state->mode = DICE_NORMAL;
        if (!dice_add(g_state, (uint8_t)code)) {
        ESP_LOGW(TAG, "Dice pool full or die invalid");
    }
    if (g_tray && !g_state->has_result) {
        if (g_motion) { lv_timer_delete(g_motion); g_motion = NULL; }
        lv_obj_clean(g_tray);
        memset(g_dice, 0, sizeof(g_dice));
    }
    update_summary();
}
static void show_session(void) {
    clear_screen();
    lv_obj_t *header = lv_label_create(g_screen);
    lv_label_set_text(header, "D&D 5e  |  SESSION LOCKED");
    lv_obj_align(header, LV_ALIGN_TOP_LEFT, 36, 12);
    const int faces[7] = {4,6,8,10,12,20,100};
    for (int i = 0; i < 7; i++) {
        char text[10]; snprintf(text, sizeof(text), "D%d", faces[i]);
        lv_obj_t *b = button(g_screen, text, 160, 94, action_event, faces[i]);
        lv_obj_set_pos(b, 26 + i * 177, 54);
    }
    const char *names[4] = {"ADV", "DIS", "CLEAR", "ROLL"};
    const int actions[4] = {-2, -3, 0, -1};
    for (int i = 0; i < 4; i++) {
        lv_obj_t *b = button(g_screen, names[i], 250, 84, action_event, actions[i]);
        lv_obj_set_pos(b, 60 + i * 300, 158);
    }
    g_tray = lv_obj_create(g_screen);
    lv_obj_set_pos(g_tray, 25, 253);
    lv_obj_set_size(g_tray, 1230, 385);
    lv_obj_set_style_bg_color(g_tray, lv_color_hex(0x20372A), 0);
    lv_obj_set_scroll_dir(g_tray, LV_DIR_VER);
    g_summary = lv_label_create(g_screen);
    lv_obj_align(g_summary, LV_ALIGN_BOTTOM_MID, 0, -18);
    update_summary();
}
void dice_ui_start(dice_state_t *state) {
    if (!state) { ESP_LOGE(TAG, "Missing dice state"); return; }
    g_state = state;
    g_screen = lv_display_get_screen_active(NULL);
    lv_obj_set_style_bg_color(g_screen, lv_color_hex(0x101C2B), 0);
    lv_obj_set_style_text_color(g_screen, lv_color_hex(0xF4F4F4), 0);
    show_choose();
}
