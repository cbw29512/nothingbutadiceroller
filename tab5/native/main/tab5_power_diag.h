#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

// Raw INA226 readings; no inferred state-of-charge or charge current sign.
typedef struct {
    bool voltage_valid;
    uint32_t battery_mv;
    bool shunt_valid;
    int32_t shunt_uv;
    esp_err_t error;
} tab5_power_reading_t;

// Read battery bus voltage and shunt voltage; do not change charging pins.
tab5_power_reading_t tab5_power_diag_read(void);

// A stable display/report format with explicit charge *command*, not current.
void tab5_power_diag_format(char *buf, size_t size,
                            const tab5_power_reading_t *reading,
                            bool charge_command_enabled);
