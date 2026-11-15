#include "orientation.h"
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

static lv_display_rotation_t determine(float x, float y, float z,
                                      lv_display_rotation_t fallback) {
    // Ignore nearly flat or diagonal poses to prevent jitter while rolling.
    float ax = x < 0 ? -x : x, ay = y < 0 ? -y : y;
    float az = z < 0 ? -z : z;
    if (az > 0.72f || (ax < 0.65f && ay < 0.65f)) return fallback;
    if (ay > ax + 0.16f) {
        return y < 0 ? LV_DISPLAY_ROTATION_180 : LV_DISPLAY_ROTATION_0;
    }
    if (ax > ay + 0.16f) {
        return x < 0 ? LV_DISPLAY_ROTATION_270 : LV_DISPLAY_ROTATION_90;
    }
    return fallback;
}
static void monitor(void *arg) {
    lv_display_t *display = (lv_display_t *)arg;
    lv_display_rotation_t current = LV_DISPLAY_ROTATION_180;
    lv_display_rotation_t candidate = current;
    unsigned stable = 0;
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(150));
        if (!sample_valid) continue;
        lv_display_rotation_t next = determine(acc_x, acc_y, acc_z, current);
        if (next == current) { stable = 0; candidate = current; continue; }
        if (next != candidate) { candidate = next; stable = 1; continue; }
        if (++stable < 4) continue;
        if (!bsp_display_lock(1000)) {
            ESP_LOGW(TAG, "LVGL lock busy; rotation deferred");
            continue;
        }
        bsp_display_rotate(display, candidate);
        dice_ui_relayout();
        bsp_display_unlock();
        current = candidate;
        stable = 0;
        ESP_LOGI(TAG, "Rotated to orientation code %d", (int)current);
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
