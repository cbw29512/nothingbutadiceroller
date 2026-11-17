#include "dice_engine.h"
#include "dice_ui.h"
#include "orientation.h"
#include "tab5_power.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_random.h"
#include "lvgl.h"

static const char *TAG = "tab5_dice";
static dice_state_t state;
void app_main(void) {
    dice_state_reset(&state);
    lv_display_t *display = bsp_display_start();
    if (!display) {
        ESP_LOGE(TAG, "Tab5 BSP display initialization failed; refusing to continue");
        return;
    }
    // Display bring-up initialized the board's shared I2C bus.
    // The BSP does not automatically enable IP2326 battery charging.
    // Failure is logged; do not prevent running the die roller on USB.
    if (!tab5_power_init()) {
        ESP_LOGW(TAG, "Battery charging is not active; inspect power logs");
    }
    if (bsp_display_brightness_set(85) != ESP_OK) {
        ESP_LOGW(TAG, "Could not set LCD brightness");
    }
    // Board's ESP-IDF startup entropy prerequisites must be verified on hardware.
    // ESP32-P4 boot enables SAR ADC entropy source by default (IDF v6.1 docs).
    if (!bsp_display_lock(0)) {
        ESP_LOGE(TAG, "LVGL mutex unavailable");
        return;
    }
    dice_ui_start(&state);
    bsp_display_unlock();
    orientation_start(display);
    ESP_LOGI(TAG, "Tab5 dice selection interface initialized");
}
