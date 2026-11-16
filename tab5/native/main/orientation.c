#include "orientation.h"
#include "orientation_policy.h"
#include "dice_ui.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "orientation";
static volatile float acc_x, acc_y, acc_z;
static volatile bool sample_valid;
static sensor_handle_t imu;

static void sensor_event(void *arg, esp_event_base_t base,
                         int32_t event, void *data) {
    (void)arg; (void)base;
    if (event != SENSOR_ACCE_DATA_READY || !data) return;
    sensor_data_t *s = (sensor_data_t *)data;
    acc_x = s->acce.x; acc_y = s->acce.y; acc_z = s->acce.z;
    sample_valid = true;
}

static lv_display_rotation_t display_angle(int angle) {
    switch (angle) {
        case 0: return LV_DISPLAY_ROTATION_0;
        case 1: return LV_DISPLAY_ROTATION_90;
        case 2: return LV_DISPLAY_ROTATION_180;
        case 3: return LV_DISPLAY_ROTATION_270;
        default: return LV_DISPLAY_ROTATION_180;
    }
}
static void monitor(void *arg) {
    lv_display_t *display = (lv_display_t *)arg;
    orientation_policy_t policy;
    orientation_policy_init(&policy, 2);
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(150));
        if (!sample_valid) continue;
        // Copy sample once; sensor callback writes only, monitor reads only.
        const float x = acc_x, y = acc_y, z = acc_z;
        int chosen = -1;
        if (!orientation_policy_sample(&policy, x, y, z, &chosen)) continue;
        if (!bsp_display_lock(1000)) {
            ESP_LOGW(TAG, "LVGL lock busy; orientation stays at prior angle");
            continue;
        }
        bsp_display_rotate(display, display_angle(chosen));
        dice_ui_relayout();
        bsp_display_unlock();
        ESP_LOGI(TAG, "Stable upright stand orientation=%d (x=%.2f y=%.2f z=%.2f)",
                 chosen, (double)x, (double)y, (double)z);
    }
}
void orientation_start(lv_display_t *display) {
    if (!display) { ESP_LOGE(TAG, "Missing display"); return; }
    bsp_sensor_config_t config = {
        .type = IMU_ID, .mode = MODE_POLLING, .period = 100
    };
    // Tab5's native panel is mounted 180 degrees from the original IMU mapping.
    // Apply a stable readable baseline even when the device is lying flat.
    if (bsp_display_lock(1000)) {
        bsp_display_rotate(display, LV_DISPLAY_ROTATION_180);
        dice_ui_relayout();
        bsp_display_unlock();
    } else {
        ESP_LOGW(TAG, "Could not apply baseline orientation; retaining BSP default");
    }
    esp_err_t err = bsp_sensor_init(&config, &imu);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "BMI270 init failed (%s); keeping stable orientation",
                 esp_err_to_name(err));
        return;
    }
    err = iot_sensor_handler_register(imu, sensor_event, NULL);
    if (err == ESP_OK) err = iot_sensor_start(imu);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "BMI270 start failed (%s)", esp_err_to_name(err));
        return;
    }
    if (xTaskCreate(monitor, "dice_rotation", 4096, display, 4, NULL) != pdPASS)
        ESP_LOGE(TAG, "Orientation task allocation failed");
}
