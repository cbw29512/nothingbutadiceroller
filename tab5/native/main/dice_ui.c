#include "dice_ui.h"
#include "dice_controls.h"
#include "dice_tray.h"
#include "dice_ui_footer.h"
#include "dice_widgets.h"
#include "dice_ui_layout.h"
#include "dice_ui_boot.h"
#include "dice_nat_event.h"
#include "dice_nat_fx.h"
#include "dice_nat_sound.h"
#include "tab5_power_widget.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_random.h"
#include "lvgl.h"
#include <stdio.h>
#include <string.h>
static const char *TAG = "dice_ui";
static dice_state_t *g_state;
static lv_obj_t *g_screen, *g_tray, *g_summary;
static lv_obj_t *g_controls[10];
static void show_session(void);
static void roll_start(void);
static void on_roll_settled(void) {
    const dice_nat_event_t event = dice_nat_event_detect(g_state);
    dice_nat_fx_show(g_screen, event);
    dice_nat_sound_play(event);
}
static void clear_screen(void) {
    dice_nat_fx_cancel();
    tab5_power_widget_detach();
    dice_tray_release();
    lv_obj_clean(g_screen);
    g_tray = NULL; g_summary = NULL;
    memset(g_controls, 0, sizeof(g_controls));
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
    dice_nat_fx_cancel();
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
    dice_nat_fx_cancel();
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
    const char *names[3] = {"ADV", "DIS", "ROLL"};
    const int actions[3] = {-2, -3, -1};
    for (int i = 0; i < 3; i++) {
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
    dice_tray_set_settled_callback(on_roll_settled);
    lv_obj_set_style_bg_color(g_tray, lv_color_hex(0x20372A), 0);
    lv_obj_set_scroll_dir(g_tray, LV_DIR_VER);
    g_summary = dice_ui_footer_create(g_screen);
    if (!g_summary) { ESP_LOGE(TAG, "Footer creation failed"); return; }
    update_summary();
    dice_ui_relayout();
    tab5_power_widget_attach(g_screen);
}
void dice_ui_start(dice_state_t *state) {
    if (!state) { ESP_LOGE(TAG, "Missing dice state"); return; }
    g_state = state;
    g_screen = lv_display_get_screen_active(NULL);
    if (!g_screen) { ESP_LOGE(TAG, "Could not resolve active screen"); return; }
    lv_obj_set_style_bg_color(g_screen, lv_color_hex(0x101C2B), 0);
    lv_obj_set_style_text_color(g_screen, lv_color_hex(0xF4F4F4), 0);
    dice_ui_boot_bind(g_screen, g_state, clear_screen, show_session);
    dice_ui_boot_show_choose();
}
void dice_ui_relayout(void) {
    if (!g_state) return;
    dice_ui_layout_reflow(g_state, g_controls, g_tray, g_summary);
}
