#pragma once
#include <stdbool.h>
#include <stdint.h>

// One human-confirmed recovery attempt; never enable charging unattended.
#define TAB5_RECOVERY_PROBE_MS 30000
#define TAB5_RECOVERY_SETTLE_MS 2000

// Stop if the monitored bus exceeds the nominal two-cell pack ceiling.
bool tab5_recovery_probe_voltage_safe(uint32_t mv);

// Detect the pack only with the charger switched OFF and settled.
bool tab5_recovery_pack_visible_with_charger_off(uint32_t mv);
