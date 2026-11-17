#include "tab5_power.h"
#include "tab5_power_policy.h"
#include "bsp/esp-bsp.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_io_expander.h"
#include "driver/i2c_master.h"

static const char *TAG = "tab5_power";
static bool g_charge_command_enabled = false;
#define BATTERY_INA226_ADDR 0x41
#define INA226_BUS_VOLTAGE_REG 0x02
#define CHARGE_ENABLE IO_EXPANDER_PIN_NUM_7
#define QUICK_CHARGE_DISABLE IO_EXPANDER_PIN_NUM_5

static esp_err_t read_pack_mv(uint32_t *millivolts) {
    if (!millivolts) return ESP_ERR_INVALID_ARG;
    i2c_master_bus_handle_t bus = bsp_i2c_get_handle();
    if (!bus) return ESP_ERR_INVALID_STATE;

    // A protected battery may look absent. Do not override this reading
    // automatically; only the user's explicit recovery action may do so.
    i2c_device_config_t config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = BATTERY_INA226_ADDR,
        .scl_speed_hz = 100000
    };
    i2c_master_dev_handle_t dev = NULL;
    esp_err_t err = i2c_master_bus_add_device(bus, &config, &dev);
    if (err != ESP_OK) return err;

    const uint8_t register_address = INA226_BUS_VOLTAGE_REG;
    uint8_t raw[2] = {0};
    err = i2c_master_transmit_receive(dev, &register_address, 1,
                                      raw, sizeof(raw), 100);
    const esp_err_t cleanup = i2c_master_bus_rm_device(dev);
    if (err != ESP_OK) return err;
    if (cleanup != ESP_OK) return cleanup;
    *millivolts = tab5_power_decode_ina226_mv(raw[0], raw[1]);
    return ESP_OK;
}

bool tab5_power_command_set(bool enable) {
    // The Tab5 IP2326 is controlled by the SECOND I/O expander (0x44).
    // P5 HIGH disables quick charge; P7 HIGH enables standard charging.
    esp_io_expander_handle_t io = bsp_io_expander1_init();
    if (!io) {
        ESP_LOGE(TAG, "Battery charger expander initialization failed");
        return false;
    }
    esp_err_t err = esp_io_expander_set_dir(
        io, CHARGE_ENABLE | QUICK_CHARGE_DISABLE, IO_EXPANDER_OUTPUT);
    if (err == ESP_OK)
        err = esp_io_expander_set_level(io, QUICK_CHARGE_DISABLE, 1);
    if (err == ESP_OK)
        err = esp_io_expander_set_output_mode(
            io, QUICK_CHARGE_DISABLE, IO_EXPANDER_OUTPUT_MODE_PUSH_PULL);
    if (err == ESP_OK)
        err = esp_io_expander_set_level(io, CHARGE_ENABLE, enable ? 1 : 0);
    if (err == ESP_OK)
        err = esp_io_expander_set_output_mode(
            io, CHARGE_ENABLE, IO_EXPANDER_OUTPUT_MODE_PUSH_PULL);
    if (err != ESP_OK) {
        // Try to deassert CHG_EN even if an earlier expander call failed.
        const esp_err_t stop = esp_io_expander_set_level(io, CHARGE_ENABLE, 0);
        if (stop != ESP_OK)
            ESP_LOGE(TAG, "Emergency charger-disable also failed: %s",
                     esp_err_to_name(stop));
        g_charge_command_enabled = false;
        ESP_LOGE(TAG, "IP2326 charger command failed: %s",
                 esp_err_to_name(err));
        return false;
    }
    g_charge_command_enabled = enable;
    ESP_LOGI(TAG, "IP2326 charger command %s (quick charge disabled)",
             enable ? "ON" : "OFF");
    return true;
}

bool tab5_power_init(void) {
    g_charge_command_enabled = false;
    uint32_t mv = 0;
    const esp_err_t reading = read_pack_mv(&mv);
    if (reading != ESP_OK) {
        ESP_LOGE(TAG, "Battery-voltage read failed: %s",
                 esp_err_to_name(reading));
        return false;
    }
    ESP_LOGI(TAG, "INA226 battery bus: %lu mV", (unsigned long)mv);
    if (!tab5_power_pack_present_mv(mv)) {
        ESP_LOGW(TAG, "Battery voltage not independently verified; charger OFF. "
                 "If a pack is fitted, use the on-screen supervised recovery.");
        return false;
    }
    return tab5_power_command_set(true);
}

bool tab5_power_charge_command_enabled(void) {
    return g_charge_command_enabled;
}
