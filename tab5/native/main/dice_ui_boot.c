#include "dice_ui_boot.h"
#include "dice_widgets.h"
#include "tab5_power_widget.h"
#include "esp_log.h"
#include <stdint.h>

static const char *TAG = "dice_ui_boot";
static lv_obj_t *screen;
static dice_state_t *state;
static void (*clear_view)(void);
static void (*start_session)(void);
static void show_confirm(void);

void dice_ui_boot_bind(lv_obj_t *parent, dice_state_t *model,
                       void (*clear_screen)(void),
                       void (*show_session)(void)) {
    screen = parent;
    state = model;
    clear_view = clear_screen;
    start_session = show_session;
}
static void choose_event(lv_event_t *event) {
    (void)event;
    if (!state || !dice_select(state, 0)) {
        ESP_LOGE(TAG, "Game system selection refused");
        return;
    }
    show_confirm();
}
static void confirm_event(lv_event_t *event) {
    const intptr_t yes = (intptr_t)lv_event_get_user_data(event);
    if (!state) { ESP_LOGE(TAG, "Missing confirmation state"); return; }
    if (yes) {
        if (!dice_confirm(state)) {
            ESP_LOGE(TAG, "Session confirmation failed");
            return;
        }
        if (start_session) start_session();
    } else {
        dice_state_reset(state);
        dice_ui_boot_show_choose();
    }
}
void dice_ui_boot_show_choose(void) {
    if (!screen || !state || !clear_view) {
        ESP_LOGE(TAG, "Missing boot-screen dependency");
        return;
    }
    clear_view();
    lv_obj_t *title = lv_label_create(screen);
    if (!title) { ESP_LOGE(TAG, "Missing system title"); return; }
    lv_label_set_text(title, "CHOOSE YOUR DICE SYSTEM");
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 100);
    lv_obj_t *button = dice_widget_button(screen, "D&D 5e", 350, 120,
                                          choose_event, 0);
    if (!button) { ESP_LOGE(TAG, "Missing system button"); return; }
    lv_obj_align(button, LV_ALIGN_CENTER, 0, 0);
    lv_obj_t *hint = lv_label_create(screen);
    if (!hint) { ESP_LOGE(TAG, "Missing system hint"); return; }
    lv_label_set_text(hint, "Additional verified game profiles are coming.");
    lv_obj_align(hint, LV_ALIGN_BOTTOM_MID, 0, -100);
    tab5_power_widget_attach(screen);
}
static void show_confirm(void) {
    if (!screen || !state || !clear_view) {
        ESP_LOGE(TAG, "Missing confirmation dependencies");
        return;
    }
    clear_view();
    lv_obj_t *label = lv_label_create(screen);
    if (!label) { ESP_LOGE(TAG, "Missing confirmation label"); return; }
    lv_label_set_text(label, "START D&D 5e?\nLocked until device restart.");
    lv_obj_align(label, LV_ALIGN_CENTER, 0, -120);
    lv_obj_t *yes = dice_widget_button(screen, "START", 310, 115,
                                       confirm_event, 1);
    if (!yes) { ESP_LOGE(TAG, "Missing START button"); return; }
    lv_obj_align(yes, LV_ALIGN_CENTER, 180, 30);
    lv_obj_t *no = dice_widget_button(screen, "CHANGE", 310, 115,
                                      confirm_event, 0);
    if (!no) { ESP_LOGE(TAG, "Missing CHANGE button"); return; }
    lv_obj_align(no, LV_ALIGN_CENTER, -180, 30);
    tab5_power_widget_attach(screen);
}
