#include "tab5_power_diag.h"
#include "tab5_power_policy.h"
#include "bsp/esp-bsp.h"
#include "driver/i2c_master.h"
#include <stdio.h>

#define INA226_ADDRESS 0x41
#define INA226_SHUNT_VOLTAGE 0x01
#define INA226_BUS_VOLTAGE 0x02

static esp_err_t read_register(i2c_master_dev_handle_t dev, uint8_t reg,
                               uint8_t bytes[2]) {
    return i2c_master_transmit_receive(dev, &reg, 1, bytes, 2, 100);
}

tab5_power_reading_t tab5_power_diag_read(void) {
    tab5_power_reading_t status = {.error = ESP_OK};
    i2c_master_bus_handle_t bus = bsp_i2c_get_handle();
    if (!bus) {
        status.error = ESP_ERR_INVALID_STATE;
        return status;
    }

    // INA226 on the Tab5 measures the 2-cell NP-F550 battery line.
    const i2c_device_config_t config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = INA226_ADDRESS,
        .scl_speed_hz = 100000
    };
    i2c_master_dev_handle_t dev = NULL;
    status.error = i2c_master_bus_add_device(bus, &config, &dev);
    if (status.error != ESP_OK) return status;

    uint8_t bytes[2] = {0};
    status.error = read_register(dev, INA226_BUS_VOLTAGE, bytes);
    if (status.error == ESP_OK) {
        status.battery_mv = tab5_power_decode_ina226_mv(bytes[0], bytes[1]);
        status.voltage_valid = true;

        // Shunt data is diagnostic only. It must never gate charge enable.
        const esp_err_t shunt_error = read_register(
            dev, INA226_SHUNT_VOLTAGE, bytes);
        if (shunt_error == ESP_OK) {
            status.shunt_uv = tab5_power_decode_ina226_shunt_uv(
                bytes[0], bytes[1]);
            status.shunt_valid = true;
        }
    }

    const esp_err_t cleanup_error = i2c_master_bus_rm_device(dev);
    if (status.error == ESP_OK && cleanup_error != ESP_OK)
        status.error = cleanup_error;
    return status;
}

void tab5_power_diag_format(char *buf, size_t size,
                            const tab5_power_reading_t *r,
                            bool charge_command_enabled) {
    if (!buf || size == 0) return;
    if (!r || !r->voltage_valid) {
        snprintf(buf, size, "BAT READ FAILED: %s | CHG CMD %s",
                 esp_err_to_name(r ? r->error : ESP_ERR_INVALID_ARG),
                 charge_command_enabled ? "ON" : "OFF");
    } else if (!r->shunt_valid) {
        snprintf(buf, size, "BAT %lu.%03luV | SHUNT UNAVAILABLE | CHG CMD %s",
                 (unsigned long)(r->battery_mv / 1000),
                 (unsigned long)(r->battery_mv % 1000),
                 charge_command_enabled ? "ON" : "OFF");
    } else {
        // Signed shunt microvolts, deliberately not a guessed charge rate.
        snprintf(buf, size, "BAT %lu.%03luV | SHUNT %+lduV | CHG CMD %s",
                 (unsigned long)(r->battery_mv / 1000),
                 (unsigned long)(r->battery_mv % 1000),
                 (long)r->shunt_uv,
                 charge_command_enabled ? "ON" : "OFF");
    }
}
