#include "tab5_recovery_policy.h"

bool tab5_recovery_probe_voltage_safe(uint32_t mv) {
    // M5Stack NP-F550: 2 cells, nominal 7.4V, max about 8.4V.
    return mv <= 8450;
}

bool tab5_recovery_pack_visible_with_charger_off(uint32_t mv) {
    // An empty bay may show residual / charger-output voltage.
    // Check with charger off, never while it is driving the battery bus.
    return mv >= 5500 && tab5_recovery_probe_voltage_safe(mv);
}
