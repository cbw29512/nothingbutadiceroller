#include "dice_ui.h"
#include "dice_controls.h"
#include "dice_tray.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_random.h"
#include "lvgl.h"
#include <stdio.h>
#include <string.h>

static const char *TAG = "dice_ui";
static dice_state_t *g_state;
static lv_obj_t *g_screen, *g_tray, *g_summary;
static lv_obj_t *g_controls[11];

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
    dice_tray_release();
    lv_obj_clean(g_screen);
    g_tray = NULL; g_summary = NULL;
    memset(g_controls, 0, sizeof(g_controls));
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
        snprintf(buf, sizeof(buf), "Tap a die to roll  |  ROLL repeats  |  CLEAR resets");
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
static void roll_start(void) {
    if (!g_state->count) {
        ESP_LOGW(TAG, "ROLL ignored: no dice selected");
        return;
    }
    if (!dice_roll(g_state, esp_random)) {
        ESP_LOGE(TAG, "Secure roll failed; result unchanged");
        return;
    }
    dice_tray_render(g_state);
    update_summary();
}
static void action_event(lv_event_t *e) {
    const int code = (int)(intptr_t)lv_event_get_user_data(e);
    // Each tap must produce a visible outcome, except CLEAR.
    const dice_control_result_t result = dice_apply_control(g_state, code);
    ESP_LOGI(TAG, "Tap control=%d, result=%d, count=%u",
             code, (int)result, (unsigned)g_state->count);
    if (result == DICE_CONTROL_REJECTED) {
        ESP_LOGW(TAG, "Ignored control=%d (pool full, empty or invalid)", code);
        return;
    }
    if (result == DICE_CONTROL_ROLL_NOW) {
        roll_start();
        return;
    }
    // Clear the old visuals only when a valid CLEAR action is received.
    dice_tray_clear();
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
        g_controls[i] = b;
    }
    const char *names[4] = {"ADV", "DIS", "CLEAR", "ROLL"};
    const int actions[4] = {-2, -3, 0, -1};
    for (int i = 0; i < 4; i++) {
        lv_obj_t *b = button(g_screen, names[i], 250, 84, action_event, actions[i]);
        g_controls[7 + i] = b;
    }
    g_tray = lv_obj_create(g_screen);
    lv_obj_set_size(g_tray, 500, 300);
    lv_obj_set_style_pad_all(g_tray, 0, 0);
    lv_obj_set_style_border_width(g_tray, 0, 0);
    lv_obj_set_scrollbar_mode(g_tray, LV_SCROLLBAR_MODE_AUTO);
    dice_tray_bind(g_tray);
    lv_obj_set_style_bg_color(g_tray, lv_color_hex(0x20372A), 0);
    lv_obj_set_scroll_dir(g_tray, LV_DIR_VER);
    g_summary = lv_label_create(g_screen);
    lv_obj_align(g_summary, LV_ALIGN_BOTTOM_MID, 0, -18);
    update_summary();
    dice_ui_relayout();
}
void dice_ui_start(dice_state_t *state) {
    if (!state) { ESP_LOGE(TAG, "Missing dice state"); return; }
    g_state = state;
    g_screen = lv_display_get_screen_active(NULL);
    lv_obj_set_style_bg_color(g_screen, lv_color_hex(0x101C2B), 0);
    lv_obj_set_style_text_color(g_screen, lv_color_hex(0xF4F4F4), 0);
    show_choose();
}

void dice_ui_relayout(void) {
    if (!g_screen || !g_state) return;
    lv_display_t *display = lv_display_get_default();
    int w = lv_display_get_horizontal_resolution(display);
    int h = lv_display_get_vertical_resolution(display);
    if (g_state->phase != DICE_SESSION) return;
    bool portrait = h > w;
    int cols = portrait ? 4 : 7;
    int margin = portrait ? 12 : 20;
    int gap = portrait ? 8 : 12;
    int usable = w - 2 * margin;
    int bw = (usable - (cols - 1) * gap) / cols;
    int bh = portrait ? 86 : 94;
    int y0 = portrait ? 48 : 52;
    for (int i = 0; i < 11; i++) {
        if (!g_controls[i]) continue;
        // In landscape place action buttons on a full-width second row.
        int row, col, count, roww, startx;
        if (!portrait && i >= 7) {
            row = 1; col = i - 7; count = 4;
            roww = (usable - 3 * gap) / 4;
            startx = margin;
        } else {
            row = i / cols; col = i % cols; count = cols;
            roww = bw; startx = margin;
        }
        (void)count;
        lv_obj_set_size(g_controls[i], roww, bh);
        lv_obj_set_pos(g_controls[i], startx + col * (roww + gap),
                       y0 + row * (bh + gap));
    }
    int rows = portrait ? 3 : 2;
    int tray_y = y0 + rows * (bh + gap) + 8;
    int summary_h = 52;
    int tray_h = h - tray_y - summary_h - 12;
    if (tray_h < 100) tray_h = 100;
    lv_obj_set_pos(g_tray, margin, tray_y);
    lv_obj_set_size(g_tray, w - 2 * margin, tray_h);
    lv_obj_align(g_summary, LV_ALIGN_BOTTOM_MID, 0, -12);
    // Keep the same random faces but resize and rearrange the visuals.
    dice_tray_relayout();
}
