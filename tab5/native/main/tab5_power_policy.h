#pragma once
#include <stdbool.h>
#include <stdint.h>

// The INA226 returns battery-pack bus voltage in 1.25mV units.
// Never enable the charger on obviously absent or implausible batteries.
bool tab5_power_pack_present_mv(uint32_t millivolts);
uint32_t tab5_power_decode_ina226_mv(uint8_t msb, uint8_t lsb);
// INA226 signed shunt-voltage register: 2.5 microvolts per LSB.
int32_t tab5_power_decode_ina226_shunt_uv(uint8_t msb, uint8_t lsb);
