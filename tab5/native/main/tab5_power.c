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

    // The INA226 monitors the battery pack, not the USB-C power meter.
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

bool tab5_power_init(void) {
    uint32_t mv = 0;
    const esp_err_t reading = read_pack_mv(&mv);
    if (reading != ESP_OK) {
        ESP_LOGE(TAG, "Battery-voltage read failed: %s",
                 esp_err_to_name(reading));
        return false;
    }
    ESP_LOGI(TAG, "INA226 battery bus: %lu mV", (unsigned long)mv);

    if (!tab5_power_pack_present_mv(mv)) {
        // Never blindly enable charge with no battery in the bay.
        ESP_LOGW(TAG, "Battery absent or outside safe detection range; "
                 "IP2326 charge remains disabled");
        return false;
    }

    // The second PI4IOE5V6408 is at I2C 0x44. P7=CHG_EN, P5=nCHG_QC_EN.
    // Disabling quick-charge (P5 high) keeps the normal charge-current path.
    // A direction write alone does NOT release the default HIGH-Z output.
    esp_io_expander_handle_t io = bsp_io_expander1_init();
    if (!io) {
        ESP_LOGE(TAG, "Failed to initialize Tab5 charger IO expander");
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
        err = esp_io_expander_set_level(io, CHARGE_ENABLE, 1);
    if (err == ESP_OK)
        err = esp_io_expander_set_output_mode(
            io, CHARGE_ENABLE, IO_EXPANDER_OUTPUT_MODE_PUSH_PULL);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Could not enable IP2326 charge: %s",
                 esp_err_to_name(err));
        return false;
    }
    g_charge_command_enabled = true;
    ESP_LOGI(TAG, "IP2326 charging enabled; quick-charge disabled");
    return true;
}

bool tab5_power_charge_command_enabled(void) {
    return g_charge_command_enabled;
}
