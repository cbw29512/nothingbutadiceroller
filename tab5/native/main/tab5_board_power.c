#include "tab5_board_power.h"
#include "bsp/esp-bsp.h"
#include "esp_io_expander.h"
#include "esp_log.h"

static const char *TAG = "tab5_board_power";
#define POWER_OFF_PULSE IO_EXPANDER_PIN_NUM_4

bool tab5_board_poweroff_idle_init(void) {
    // M5Stack factory firmware sets IO expander 0x44 P4 output LOW.
    // P4 HIGH pulses the hardware power-off latch: never write HIGH.
    esp_io_expander_handle_t io = bsp_io_expander1_init();
    if (!io) {
        ESP_LOGE(TAG, "Could not initialize power-off expander");
        return false;
    }
    esp_err_t err = esp_io_expander_set_dir(
        io, POWER_OFF_PULSE, IO_EXPANDER_OUTPUT);
    if (err == ESP_OK)
        err = esp_io_expander_set_level(io, POWER_OFF_PULSE, 0);
    if (err == ESP_OK)
        err = esp_io_expander_set_output_mode(
            io, POWER_OFF_PULSE, IO_EXPANDER_OUTPUT_MODE_PUSH_PULL);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Power-off idle LOW configuration failed: %s",
                 esp_err_to_name(err));
        return false;
    }
    ESP_LOGI(TAG, "Power-off pulse P4 held LOW (factory idle state)");
    return true;
}
