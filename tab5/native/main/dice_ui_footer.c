#include "dice_ui_footer.h"
#include "dice_summary.h"
#include "esp_log.h"

lv_obj_t *dice_ui_footer_create(lv_obj_t *parent) {
    if (!parent) {
        ESP_LOGE("dice_ui_footer", "Cannot create footer without parent");
        return NULL;
    }
    lv_obj_t *summary = lv_label_create(parent);
    if (!summary) {
        ESP_LOGE("dice_ui_footer", "Could not allocate summary label");
        return NULL;
    }
    // The 36px Montserrat face is enabled in sdkconfig.defaults.
    lv_obj_set_style_text_font(summary, &lv_font_montserrat_36, 0);
    lv_obj_set_style_text_align(summary, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(summary, LV_LABEL_LONG_WRAP);
    return summary;
}

void dice_ui_footer_update(const dice_state_t *state, lv_obj_t *summary,
                           lv_obj_t *adv_button, lv_obj_t *dis_button) {
    if (!state || !summary) {
        ESP_LOGE("dice_ui_footer", "Cannot update missing state or footer");
        return;
    }
    char buf[256];
    if (!dice_summary_format(state, buf, sizeof(buf))) {
        ESP_LOGE("dice_ui_footer", "Dice summary formatting failed");
        return;
    }
    lv_label_set_text(summary, buf);
    if (adv_button)
        lv_obj_set_style_bg_color(adv_button, lv_color_hex(
            state->mode == DICE_ADV ? 0x287F5A : 0x355679), 0);
    if (dis_button)
        lv_obj_set_style_bg_color(dis_button, lv_color_hex(
            state->mode == DICE_DIS ? 0x9B533B : 0x355679), 0);
}
