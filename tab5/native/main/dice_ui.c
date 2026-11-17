#include "dice_ui.h"
#include "dice_controls.h"
#include "dice_tray.h"
#include "dice_ui_footer.h"
#include "dice_widgets.h"
#include "dice_ui_layout.h"
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
    lv_obj_t *b = dice_widget_button(g_screen, "D&D 5e", 350, 120, choose_event, 0);
    if (!b) { ESP_LOGE(TAG, "Could not allocate system choice"); return; }
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
    lv_obj_t *yes = dice_widget_button(g_screen, "START", 310, 115, confirm_event, 1);
    if (!yes) { ESP_LOGE(TAG, "Could not allocate START button"); return; }
    lv_obj_align(yes, LV_ALIGN_CENTER, 180, 30);
    lv_obj_t *no = dice_widget_button(g_screen, "CHANGE", 310, 115, confirm_event, 0);
    if (!no) { ESP_LOGE(TAG, "Could not allocate CHANGE button"); return; }
    lv_obj_align(no, LV_ALIGN_CENTER, -180, 30);
}
static void update_summary(void) {
    dice_ui_footer_update(g_state, g_summary, g_controls[7], g_controls[8]);
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
    // Die taps queue; ROLL/ADV/DIS execute exactly one secure roll.
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
    // Selection changes invalidate the old tray without rolling again.
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
        lv_obj_t *b = dice_widget_button(g_screen, text, 160, 94, action_event, faces[i]);
        if (!b) { ESP_LOGE(TAG, "Could not allocate die control"); return; }
        g_controls[i] = b;
    }
    const char *names[4] = {"ADV", "DIS", "CLEAR", "ROLL"};
    const int actions[4] = {-2, -3, 0, -1};
    for (int i = 0; i < 4; i++) {
        lv_obj_t *b = dice_widget_button(g_screen, names[i], 250, 84, action_event, actions[i]);
        if (!b) { ESP_LOGE(TAG, "Could not allocate action control"); return; }
        g_controls[7 + i] = b;
    }
    g_tray = lv_obj_create(g_screen);
    if (!g_tray) { ESP_LOGE(TAG, "Could not allocate dice tray"); return; }
    lv_obj_set_size(g_tray, 500, 300);
    lv_obj_set_style_pad_all(g_tray, 0, 0);
    lv_obj_set_style_border_width(g_tray, 0, 0);
    lv_obj_set_scrollbar_mode(g_tray, LV_SCROLLBAR_MODE_AUTO);
    dice_tray_bind(g_tray);
    lv_obj_set_style_bg_color(g_tray, lv_color_hex(0x20372A), 0);
    lv_obj_set_scroll_dir(g_tray, LV_DIR_VER);
    g_summary = dice_ui_footer_create(g_screen);
    if (!g_summary) { ESP_LOGE(TAG, "Footer creation failed"); return; }
    update_summary();
    dice_ui_relayout();
}
void dice_ui_start(dice_state_t *state) {
    if (!state) { ESP_LOGE(TAG, "Missing dice state"); return; }
    g_state = state;
    g_screen = lv_display_get_screen_active(NULL);
    if (!g_screen) { ESP_LOGE(TAG, "Could not resolve active screen"); return; }
    lv_obj_set_style_bg_color(g_screen, lv_color_hex(0x101C2B), 0);
    lv_obj_set_style_text_color(g_screen, lv_color_hex(0xF4F4F4), 0);
    show_choose();
}
void dice_ui_relayout(void) {
    if (!g_state) return;
    dice_ui_layout_reflow(g_state, g_controls, g_tray, g_summary);
}
