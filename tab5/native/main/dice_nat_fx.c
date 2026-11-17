#include "dice_nat_fx.h"
#include "dice_critical_art.h"
#include "esp_log.h"

static const char *TAG = "dice_nat_fx";
static lv_obj_t *overlay, *hero, *title, *footer;
static lv_timer_t *timer;
static dice_nat_event_t active;
static unsigned frame;
static dice_critical_art_t art;

bool dice_nat_fx_is_active(void) { return overlay != NULL; }
void dice_nat_fx_cancel(void) {
    if (timer) { lv_timer_delete(timer); timer = NULL; }
    if (overlay) { lv_obj_delete(overlay); overlay = NULL; }
    hero = NULL; title = NULL; footer = NULL;
    frame = 0; active = DICE_NAT_NONE;
    art.event = DICE_NAT_NONE; art.frame = 0;
}

static void set_colors(bool flash) {
    if (!overlay) return;
    const bool success = active == DICE_NAT_20;
    const uint32_t bright = success ? 0xFFF36A : 0xFF6674;
    const uint32_t dark = success ? 0x25190A : 0x280916;
    const uint32_t accent = success ? 0xE7FF00 : 0xFF8C9F;
    lv_obj_set_style_bg_color(overlay, lv_color_hex(flash ? bright : dark), 0);
    lv_obj_set_style_border_color(overlay, lv_color_hex(accent), 0);
    if (hero)
        lv_obj_set_style_text_color(hero, lv_color_hex(flash ? 0x101925 : accent), 0);
    if (title)
        lv_obj_set_style_text_color(title, lv_color_hex(flash ? 0x101925 : 0xFFFFFF), 0);
    if (footer)
        lv_obj_set_style_text_color(footer, lv_color_hex(flash ? 0x101925 : accent), 0);
}
static void tick(lv_timer_t *unused) {
    (void)unused;
    if (!overlay) { dice_nat_fx_cancel(); return; }
    ++frame;
    art.frame = frame;
    lv_obj_invalidate(overlay);
    // Two deliberate pulses at 2 Hz, never a rapid strobe.
    set_colors((frame >= 1 && frame <= 2) ||
               (frame >= 7 && frame <= 8));
    if (frame >= 19) dice_nat_fx_cancel();
}
static lv_obj_t *make_label(lv_obj_t *parent, const char *str,
                            const lv_font_t *font, int y) {
    lv_obj_t *label = lv_label_create(parent);
    if (!label) return NULL;
    lv_obj_set_width(label, lv_pct(94));
    lv_label_set_text(label, str);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_font(label, font, 0);
    lv_obj_align(label, LV_ALIGN_CENTER, 0, y);
    return label;
}
void dice_nat_fx_show(lv_obj_t *screen, dice_nat_event_t event) {
    dice_nat_fx_cancel();
    if (!screen || (event != DICE_NAT_20 && event != DICE_NAT_1)) return;
    active = event;
    art.event = event; art.frame = 0;
    overlay = lv_obj_create(screen);
    if (!overlay) {
        ESP_LOGE(TAG, "Could not allocate natural-roll overlay");
        active = DICE_NAT_NONE;
        return;
    }
    lv_obj_set_size(overlay, lv_pct(100), lv_pct(100));
    lv_obj_set_pos(overlay, 0, 0);
    lv_obj_set_style_radius(overlay, 0, 0);
    lv_obj_set_style_pad_all(overlay, 0, 0);
    lv_obj_set_style_border_width(overlay, 12, 0);
    lv_obj_set_style_bg_opa(overlay, LV_OPA_COVER, 0);
    lv_obj_clear_flag(overlay, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_event_cb(overlay, dice_critical_art_draw,
                        LV_EVENT_DRAW_MAIN, &art);
    hero = make_label(overlay, event == DICE_NAT_20 ? "20" : "1",
                      &lv_font_montserrat_48, -100);
    title = make_label(overlay, event == DICE_NAT_20 ?
                       "NATURAL 20!" : "NATURAL 1!",
                       &lv_font_montserrat_36, -12);
    footer = make_label(overlay, event == DICE_NAT_20 ?
                        "CRITICAL HIT!" : "CRITICAL MISS!",
                        &lv_font_montserrat_36, 72);
    if (!hero || !title || !footer) {
        ESP_LOGE(TAG, "Natural-roll labels could not be allocated");
        dice_nat_fx_cancel();
        return;
    }
    set_colors(false);
    // Timer is presentation-only; normal dice and roll totals remain intact.
    timer = lv_timer_create(tick, 100, NULL);
    if (!timer) {
        ESP_LOGE(TAG, "Natural-roll effect timer unavailable");
        dice_nat_fx_cancel();
    }
}
