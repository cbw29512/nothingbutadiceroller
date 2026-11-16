#include "dice_visuals.h"
#include "dice_shapes.h"
#include "esp_log.h"

static const char *TAG = "dice_visuals";

lv_obj_t *dice_visual_create(lv_obj_t *tray, uint8_t sides, uint16_t face,
                             int size, bool discarded) {
    if (!tray || size < 40 || face < 1 || face > sides) {
        ESP_LOGE(TAG, "Invalid die object: sides=%u face=%u size=%d",
                 (unsigned)sides, (unsigned)face, size);
        return NULL;
    }
    lv_obj_t *die = lv_obj_create(tray);
    if (!die) { ESP_LOGE(TAG, "LVGL could not allocate die"); return NULL; }
    lv_obj_set_size(die, size, size);
    lv_obj_set_style_pad_all(die, 0, 0);
    lv_obj_set_style_border_width(die, 0, 0);
    lv_obj_set_style_bg_opa(die, LV_OPA_TRANSP, 0);
    lv_obj_clear_flag(die, LV_OBJ_FLAG_SCROLLABLE);
    dice_shapes_attach(die, sides, discarded);

    lv_obj_t *face_label = lv_label_create(die);
    if (!face_label) { lv_obj_delete(die); return NULL; }
    lv_label_set_text_fmt(face_label, "%u", (unsigned)face);
    const lv_font_t *font = size >= 180 ? &lv_font_montserrat_48 :
                            size >= 126 ? &lv_font_montserrat_36 :
                                          &lv_font_montserrat_28;
    lv_obj_set_style_text_font(face_label, font, 0);
    lv_obj_set_style_text_color(face_label, lv_color_hex(0xFFFFFF), 0);
    lv_obj_set_style_text_opa(face_label, discarded ? LV_OPA_70 : LV_OPA_COVER, 0);
    lv_obj_align(face_label, LV_ALIGN_CENTER, 0, -size / 18);

    lv_obj_t *type_label = lv_label_create(die);
    if (!type_label) { lv_obj_delete(die); return NULL; }
    lv_label_set_text_fmt(type_label, "d%u%s", (unsigned)sides,
                          discarded ? " OUT" : "");
    lv_obj_set_style_text_font(type_label, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(type_label, lv_color_hex(0xEDF5F6), 0);
    lv_obj_align(type_label, LV_ALIGN_CENTER, 0, size / 4);
    return die;
}
