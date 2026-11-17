#include "dice_widgets.h"
#include "esp_log.h"

lv_obj_t *dice_widget_button(lv_obj_t *parent, const char *name,
                             int w, int h, lv_event_cb_t cb, intptr_t code) {
    if (!parent || !name || !cb) {
        ESP_LOGE("dice_widgets", "Invalid button parameters");
        return NULL;
    }
    lv_obj_t *button = lv_button_create(parent);
    if (!button) return NULL;
    lv_obj_set_size(button, w, h);
    lv_obj_set_style_bg_color(button, lv_color_hex(0x355679), 0);
    lv_obj_set_style_radius(button, 14, 0);
    lv_obj_add_event_cb(button, cb, LV_EVENT_CLICKED, (void *)code);
    lv_obj_t *label = lv_label_create(button);
    if (!label) { lv_obj_delete(button); return NULL; }
    lv_label_set_text(label, name);
    lv_obj_center(label);
    return button;
}
