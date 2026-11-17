#pragma once
#include <stdbool.h>

// Startup charges only if the battery voltage proves a fitted 2S pack.
// A manually confirmed, time-limited low-voltage recovery uses the same
// safe normal-rate CHG_EN/P5 GPIO path.
bool tab5_power_init(void);

// Indicates a successful enable command, NOT measured charging current.
bool tab5_power_charge_command_enabled(void);

// Charger GPIO command; caller must enforce battery presence or supervised
// recovery policy. Returns false if the expander cannot be configured.
bool tab5_power_command_set(bool enable);
