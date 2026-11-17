#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "tab5_power_diag.h"

typedef enum {
    TAB5_RECOVERY_READY,
    TAB5_RECOVERY_PROBING,
    TAB5_RECOVERY_VERIFY_OFF,
    TAB5_RECOVERY_CHARGING,
    TAB5_RECOVERY_NO_PACK,
    TAB5_RECOVERY_ERROR,
    TAB5_RECOVERY_CANCELLED
} tab5_recovery_phase_t;

// Start only after an explicit two-tap confirmation that a battery is fitted.
// There is at most one time-limited recovery attempt per device boot.
bool tab5_power_recovery_begin(int64_t now_ms);
void tab5_power_recovery_poll(const tab5_power_reading_t *reading, int64_t now_ms);
bool tab5_power_recovery_cancel(void);
tab5_recovery_phase_t tab5_power_recovery_phase(void);
int32_t tab5_power_recovery_remaining_sec(int64_t now_ms);
