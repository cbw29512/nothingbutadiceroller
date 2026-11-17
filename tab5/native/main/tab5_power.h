#pragma once
#include <stdbool.h>

// Read INA226 pack voltage, enable normal-rate IP2326 charging when present.
// Returns false on errors or absent batteries. Never powers off the device.
bool tab5_power_init(void);
