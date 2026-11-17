#include "orientation.h"
#include "orientation_policy.h"
#include "dice_shake_policy.h"
#include "dice_ui.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

static const char *TAG = "orientation";
static sensor_handle_t imu;
typedef struct {
    float x, y, z;
    uint32_t time_ms;
} imu_sample_t;
static QueueHandle_t sample_queue;

static void sensor_event(void *arg, esp_event_base_t base,
                         int32_t event, void *data) {
    (void)arg; (void)base;
    if (event != SENSOR_ACCE_DATA_READY || !data || !sample_queue) return;
    const sensor_data_t *s = (const sensor_data_t *)data;
    const imu_sample_t sample = {
        .x=s->acce.x, .y=s->acce.y, .z=s->acce.z,
        .time_ms=(uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS)
    };
    // Latest event wins. Prevent torn XYZ reads and sample aliasing.
    (void)xQueueOverwrite(sample_queue, &sample);
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
    orientation_policy_t rotation;
    orientation_policy_init(&rotation, 2);
    dice_shake_policy_t shake;
    dice_shake_policy_init(&shake);
    uint32_t last_rotation_ms=0;
    unsigned timeouts=0;
    while (true) {
        imu_sample_t sample;
        if (xQueueReceive(sample_queue, &sample, pdMS_TO_TICKS(500))
            != pdTRUE) {
            if (++timeouts % 10u == 0)
                ESP_LOGW(TAG,"No BMI270 accelerometer samples received");
            continue;
        }
        timeouts=0;
        const uint32_t ms=sample.time_ms;
        if (dice_shake_policy_sample(&shake,sample.x,sample.y,sample.z,ms)) {
            // Never manipulate UI on sensor callback; this task takes the
            // existing LVGL mutex and uses the exact ROLL-button codepath.
            if (bsp_display_lock(100)) {
                if (dice_ui_try_shake_roll())
                    ESP_LOGI(TAG,"Single shake: selected dice rolled");
                else ESP_LOGI(TAG,"Shake ignored: no selected dice or UI busy");
                bsp_display_unlock();
            } else ESP_LOGW(TAG,"Shake ignored: display mutex busy");
        }
        // Preserve the original ~150ms orientation cadence while gesture
        // detection handles every BMI270 sample (rather than 1 in 3).
        if ((uint32_t)(ms-last_rotation_ms)<150u) continue;
        last_rotation_ms=ms;
        int chosen=-1;
        const int previous=rotation.current;
        if (!orientation_policy_sample(&rotation,sample.x,sample.y,
                                        sample.z,&chosen)) continue;
        if (!bsp_display_lock(1000)) {
            orientation_policy_init(&rotation,previous);
            ESP_LOGW(TAG,"LVGL lock busy; rotation not committed");
            continue;
        }
        bsp_display_rotate(display,display_angle(chosen));
        dice_ui_relayout();
        bsp_display_unlock();
        ESP_LOGI(TAG,"Stable upright orientation=%d",chosen);
    }
}
void orientation_start(lv_display_t *display) {
    if (!display) { ESP_LOGE(TAG,"Missing display"); return; }
    // Apply the proven Tab5 baseline before accepting the IMU.
    if (bsp_display_lock(1000)) {
        bsp_display_rotate(display,LV_DISPLAY_ROTATION_180);
        dice_ui_relayout();
        bsp_display_unlock();
    } else ESP_LOGW(TAG,"Baseline rotation lock unavailable");

    // 40ms BMI270 polling: a hand shake typically reverses well inside
    // the former 100ms sensor / 150ms monitor sampling blind spot.
    const bsp_sensor_config_t config={
        .type=IMU_ID, .mode=MODE_POLLING, .period=40
    };
    esp_err_t err=bsp_sensor_init(&config,&imu);
    if (err!=ESP_OK) {
        ESP_LOGE(TAG,"BMI270 init failed: %s",esp_err_to_name(err));
        return;
    }
    sample_queue=xQueueCreate(1,sizeof(imu_sample_t));
    if (!sample_queue) {
        ESP_LOGE(TAG,"BMI270 sample queue allocation failed");
        return;
    }
    err=iot_sensor_handler_register(imu,sensor_event,NULL);
    if (err==ESP_OK) err=iot_sensor_start(imu);
    if (err!=ESP_OK) {
        ESP_LOGE(TAG,"BMI270 start failed: %s",esp_err_to_name(err));
        // Keep the queue allocated if a callback was registered; avoid a
        // dangling callback pointer even on partial sensor startup.
        return;
    }
    if (xTaskCreate(monitor,"dice_rotation",4096,display,4,NULL)!=pdPASS)
        ESP_LOGE(TAG,"BMI270 gesture task allocation failed");
    else ESP_LOGI(TAG,"BMI270 one-shake gesture detection running at 40ms");
}
