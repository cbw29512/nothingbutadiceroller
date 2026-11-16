#include "dice_ui_layout.h"
#include "dice_tray.h"
#include "esp_log.h"

void dice_ui_layout_reflow(const dice_state_t *state, lv_obj_t *const controls[11],
                           lv_obj_t *tray, lv_obj_t *summary) {
    if (!state || state->phase != DICE_SESSION || !tray || !summary) return;
    lv_display_t *display = lv_display_get_default();
    if (!display) {
        ESP_LOGE("dice_ui_layout", "Cannot reflow without LVGL display");
        return;
    }
    const int w = lv_display_get_horizontal_resolution(display);
    const int h = lv_display_get_vertical_resolution(display);
    const bool portrait = h > w;
    const int cols = portrait ? 4 : 7;
    const int margin = portrait ? 12 : 20;
    const int gap = portrait ? 8 : 12;
    const int usable = w - 2 * margin;
    const int bw = (usable - (cols - 1) * gap) / cols;
    const int bh = portrait ? 86 : 94;
    const int y0 = portrait ? 48 : 52;

    for (int i = 0; i < 11; ++i) {
        if (!controls[i]) continue;
        int row, col, button_width;
        if (!portrait && i >= 7) {
            row = 1;
            col = i - 7;
            button_width = (usable - 3 * gap) / 4;
        } else {
            row = i / cols;
            col = i % cols;
            button_width = bw;
        }
        lv_obj_set_size(controls[i], button_width, bh);
        lv_obj_set_pos(controls[i],
                       margin + col * (button_width + gap),
                       y0 + row * (bh + gap));
    }
    const int rows = portrait ? 3 : 2;
    const int tray_y = y0 + rows * (bh + gap) + 8;
    // Reserve 108 px below the tray so 36 px roll count/total never overlaps it.
    const int footer_h = 108;
    int tray_h = h - tray_y - footer_h;
    if (tray_h < 100) tray_h = 100;
    lv_obj_set_pos(tray, margin, tray_y);
    lv_obj_set_size(tray, w - 2 * margin, tray_h);
    lv_obj_set_width(summary, w - 2 * margin);
    lv_obj_align(summary, LV_ALIGN_BOTTOM_MID, 0, -24);
    // Reposition existing dice objects; the roll result stays unchanged.
    dice_tray_relayout();
}
