#include "tab5_power_widget.h"
#include "tab5_power_diag.h"
#include "tab5_power.h"
#include "esp_log.h"

static const char *TAG = "tab5_battery";
static lv_obj_t *g_label;
static lv_timer_t *g_timer;

static void refresh(lv_timer_t *timer) {
    (void)timer;
    if (!g_label) return;
    const tab5_power_reading_t reading = tab5_power_diag_read();
    char line[144] = {0};
    tab5_power_diag_format(line, sizeof(line), &reading,
                            tab5_power_charge_command_enabled());
    lv_label_set_text(g_label, line);
    lv_obj_align(g_label, LV_ALIGN_TOP_RIGHT, -16, 12);
    // Serial output is now routed to USB Serial/JTAG, and the same
    // observation stays visible on the screen if a serial port is silent.
    ESP_LOGI(TAG, "%s", line);
}

void tab5_power_widget_detach(void) {
    // The LVGL timer survives screen transitions, but never uses a freed
    // widget because callers detach before lv_obj_clean().
    g_label = NULL;
}

void tab5_power_widget_attach(lv_obj_t *screen) {
    if (!screen) {
        ESP_LOGE(TAG, "Cannot attach battery status without a screen");
        return;
    }
    g_label = lv_label_create(screen);
    if (!g_label) {
        ESP_LOGE(TAG, "Cannot allocate battery status label");
        return;
    }
    lv_obj_set_style_text_font(g_label, &lv_font_montserrat_20, 0);
    refresh(NULL);
    if (!g_timer) {
        g_timer = lv_timer_create(refresh, 15000, NULL);
        if (!g_timer)
            ESP_LOGE(TAG, "Cannot allocate battery status polling timer");
    }
}
