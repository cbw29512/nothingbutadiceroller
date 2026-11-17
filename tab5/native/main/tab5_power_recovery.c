#include "tab5_power_recovery.h"
#include "tab5_recovery_policy.h"
#include "tab5_power.h"
#include "esp_log.h"

static const char *TAG = "tab5_recovery";
static tab5_recovery_phase_t g_phase = TAB5_RECOVERY_READY;
static int64_t g_phase_start_ms;

static void fail(tab5_recovery_phase_t outcome, const char *reason) {
    if (!tab5_power_command_set(false)) {
        ESP_LOGE(TAG, "Could not verify charger shutdown after: %s", reason);
        g_phase = TAB5_RECOVERY_ERROR;
        return;
    }
    g_phase = outcome;
    ESP_LOGW(TAG, "%s; charger commanded OFF", reason);
}

bool tab5_power_recovery_begin(int64_t now_ms) {
    if (g_phase != TAB5_RECOVERY_READY ||
        tab5_power_charge_command_enabled()) {
        ESP_LOGW(TAG, "Recovery refused: not available");
        return false;
    }
    if (!tab5_power_command_set(true)) {
        g_phase = TAB5_RECOVERY_ERROR;
        ESP_LOGE(TAG, "Recovery start failed: charger control unavailable");
        return false;
    }
    g_phase_start_ms = now_ms;
    g_phase = TAB5_RECOVERY_PROBING;
    ESP_LOGW(TAG, "User-confirmed battery recovery: normal charger ON for 30s");
    return true;
}

void tab5_power_recovery_poll(const tab5_power_reading_t *r, int64_t now_ms) {
    if (g_phase != TAB5_RECOVERY_PROBING &&
        g_phase != TAB5_RECOVERY_VERIFY_OFF) return;
    if (!r || !r->voltage_valid || r->error != ESP_OK) {
        fail(TAB5_RECOVERY_ERROR, "Battery sensor read error");
        return;
    }
    if (!tab5_recovery_probe_voltage_safe(r->battery_mv)) {
        fail(TAB5_RECOVERY_ERROR, "Battery bus exceeded 8.45V cutoff");
        return;
    }

    const int64_t elapsed = now_ms - g_phase_start_ms;
    if (g_phase == TAB5_RECOVERY_PROBING &&
        elapsed >= TAB5_RECOVERY_PROBE_MS) {
        // A charger can produce a false 5-8V reading in an empty bay.
        // Switch it off and check the pack voltage after the output settles.
        if (!tab5_power_command_set(false)) {
            g_phase = TAB5_RECOVERY_ERROR;
            ESP_LOGE(TAG, "Could not verify recovery probe shutoff");
            return;
        }
        g_phase = TAB5_RECOVERY_VERIFY_OFF;
        g_phase_start_ms = now_ms;
        ESP_LOGI(TAG, "Recovery probe ended; checking charger-OFF battery voltage");
        return;
    }
    if (g_phase == TAB5_RECOVERY_VERIFY_OFF &&
        elapsed >= TAB5_RECOVERY_SETTLE_MS) {
        if (!tab5_recovery_pack_visible_with_charger_off(r->battery_mv)) {
            fail(TAB5_RECOVERY_NO_PACK,
                 "No independently detectable battery after recovery");
            return;
        }
        if (!tab5_power_command_set(true)) {
            fail(TAB5_RECOVERY_ERROR, "Normal charging enable failed");
            return;
        }
        g_phase = TAB5_RECOVERY_CHARGING;
        ESP_LOGI(TAG, "Battery verified with charger OFF; normal charge enabled");
    }
}

bool tab5_power_recovery_cancel(void) {
    if (g_phase != TAB5_RECOVERY_PROBING &&
        g_phase != TAB5_RECOVERY_VERIFY_OFF) return false;
    fail(TAB5_RECOVERY_CANCELLED, "User cancelled recovery");
    return g_phase == TAB5_RECOVERY_CANCELLED;
}

tab5_recovery_phase_t tab5_power_recovery_phase(void) {
    return g_phase;
}

int32_t tab5_power_recovery_remaining_sec(int64_t now_ms) {
    if (g_phase != TAB5_RECOVERY_PROBING) return 0;
    int64_t remaining = TAB5_RECOVERY_PROBE_MS -
                        (now_ms - g_phase_start_ms);
    if (remaining <= 0) return 0;
    return (int32_t)((remaining + 999) / 1000);
}
