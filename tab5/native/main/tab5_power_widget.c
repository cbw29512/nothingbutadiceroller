#include "tab5_power_widget.h"
#include "tab5_power_diag.h"
#include "tab5_power_recovery.h"
#include "tab5_power.h"
#include "esp_timer.h"
#include "esp_log.h"
#include <stdio.h>

static const char *TAG = "tab5_battery";
static lv_obj_t *g_label, *g_button, *g_button_label;
static lv_timer_t *g_timer;
static bool g_confirm_pending;
static uint32_t g_timer_period = 15000;

static int64_t now_ms(void) { return esp_timer_get_time() / 1000; }

static void recovery_tap(lv_event_t *event);

static void refresh(lv_timer_t *timer) {
    (void)timer;
    if (!g_label) return;
    const tab5_power_reading_t reading = tab5_power_diag_read();
    const int64_t now = now_ms();
    tab5_power_recovery_poll(&reading, now);

    char line[144] = {0};
    tab5_power_diag_format(line, sizeof(line), &reading,
                            tab5_power_charge_command_enabled());
    lv_label_set_text(g_label, line);
    lv_obj_align(g_label, LV_ALIGN_TOP_RIGHT, -16, 12);
    ESP_LOGI(TAG, "%s", line);

    const tab5_recovery_phase_t phase = tab5_power_recovery_phase();
    if (g_button && g_button_label) {
        char action[80] = {0};
        if (phase == TAB5_RECOVERY_READY &&
            !tab5_power_charge_command_enabled()) {
            snprintf(action, sizeof(action), "%s",
                     g_confirm_pending ? "CONFIRM BATTERY FITTED" :
                                         "RECOVER BATTERY (30s)");
        } else if (phase == TAB5_RECOVERY_PROBING) {
            snprintf(action, sizeof(action), "STOP RECOVERY (%lds)",
                     (long)tab5_power_recovery_remaining_sec(now));
        } else if (phase == TAB5_RECOVERY_VERIFY_OFF) {
            snprintf(action, sizeof(action), "STOP / VERIFY CHARGER OFF");
        } else {
            const char *status = phase == TAB5_RECOVERY_CHARGING ?
                "RECOVERY: CHARGER ON" :
                phase == TAB5_RECOVERY_NO_PACK ? "RECOVERY: PACK NOT DETECTED" :
                phase == TAB5_RECOVERY_CANCELLED ? "RECOVERY CANCELLED" :
                phase == TAB5_RECOVERY_ERROR ? "RECOVERY ERROR" : "";
            if (*status) {
                lv_label_set_text(g_button_label, status);
                lv_obj_clear_flag(g_button, LV_OBJ_FLAG_HIDDEN);
                lv_obj_add_state(g_button, LV_STATE_DISABLED);
            } else {
                lv_obj_add_flag(g_button, LV_OBJ_FLAG_HIDDEN);
            }
        }
        if (*action) {
            lv_label_set_text(g_button_label, action);
            lv_obj_clear_state(g_button, LV_STATE_DISABLED);
            lv_obj_clear_flag(g_button, LV_OBJ_FLAG_HIDDEN);
        }
    }

    const bool active = phase == TAB5_RECOVERY_PROBING ||
                        phase == TAB5_RECOVERY_VERIFY_OFF;
    const uint32_t desired_period = active ? 1000 : 15000;
    if (g_timer && desired_period != g_timer_period) {
        lv_timer_set_period(g_timer, desired_period);
        g_timer_period = desired_period;
    }
}

static void recovery_tap(lv_event_t *event) {
    (void)event;
    const tab5_recovery_phase_t phase = tab5_power_recovery_phase();
    if (phase == TAB5_RECOVERY_PROBING ||
        phase == TAB5_RECOVERY_VERIFY_OFF) {
        tab5_power_recovery_cancel();
    } else if (phase == TAB5_RECOVERY_READY &&
               !tab5_power_charge_command_enabled()) {
        if (!g_confirm_pending) {
            // A second deliberate tap confirms the battery is fitted.
            g_confirm_pending = true;
        } else {
            g_confirm_pending = false;
            if (!tab5_power_recovery_begin(now_ms()))
                ESP_LOGE(TAG, "User-confirmed recovery could not start");
        }
    }
    refresh(NULL);
}

void tab5_power_widget_detach(void) {
    // Cancel the confirmation on navigation, not the supervised 30s probe.
    // The timer never dereferences screen objects after lv_obj_clean().
    g_label = NULL;
    g_button = NULL;
    g_button_label = NULL;
    g_confirm_pending = false;
}

void tab5_power_widget_attach(lv_obj_t *screen) {
    if (!screen) {
        ESP_LOGE(TAG, "Missing screen for battery diagnostics");
        return;
    }
    g_label = lv_label_create(screen);
    if (!g_label) {
        ESP_LOGE(TAG, "Could not allocate battery diagnostic label");
        return;
    }
    lv_obj_set_style_text_font(g_label, &lv_font_montserrat_20, 0);
    g_button = lv_button_create(screen);
    if (!g_button) {
        ESP_LOGE(TAG, "Could not allocate manual battery recovery button");
        return;
    }
    lv_obj_set_size(g_button, 300, 54);
    lv_obj_align(g_button, LV_ALIGN_TOP_RIGHT, -16, 44);
    lv_obj_add_event_cb(g_button, recovery_tap, LV_EVENT_CLICKED, NULL);
    g_button_label = lv_label_create(g_button);
    if (!g_button_label) {
        ESP_LOGE(TAG, "Could not allocate recovery button label");
        return;
    }
    lv_obj_center(g_button_label);
    refresh(NULL);
    if (!g_timer) {
        g_timer = lv_timer_create(refresh, 15000, NULL);
        if (!g_timer)
            ESP_LOGE(TAG, "Battery diagnostic timer allocation failed");
    }
}
