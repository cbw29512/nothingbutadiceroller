#include "dice_nat_sound.h"
#include "dice_nat_tone.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "esp_codec_dev.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

#define PCM_BLOCK 256u
#define SPEAKER_VOLUME 35
static const char *TAG = "dice_nat_sound";
static QueueHandle_t sound_queue;

static bool emit_notes(esp_codec_dev_handle_t speaker,
                       dice_nat_event_t event) {
    const dice_tone_note_t *notes = NULL;
    const size_t count = dice_nat_tone_notes(event, &notes);
    if (!notes || !count) return false;

    int16_t pcm[PCM_BLOCK];
    for (size_t i = 0; i < count; ++i) {
        const uint32_t frames =
            (uint32_t)notes[i].duration_ms * DICE_TONE_SAMPLE_RATE / 1000u;
        for (uint32_t start = 0; start < frames; start += PCM_BLOCK) {
            const uint32_t remaining = frames - start;
            const uint32_t n = remaining < PCM_BLOCK ?
                                remaining : PCM_BLOCK;
            for (uint32_t j = 0; j < n; ++j) {
                pcm[j] = dice_nat_tone_sample(notes[i].frequency_hz,
                                               start + j, frames);
            }
            if (esp_codec_dev_write(speaker, pcm,
                                    n * sizeof(pcm[0])) != ESP_CODEC_DEV_OK) {
                ESP_LOGE(TAG, "I2S playback failed on note %u",
                         (unsigned)i);
                return false;
            }
        }
    }
    return true;
}

static void worker(void *unused) {
    (void)unused;
    esp_codec_dev_handle_t speaker = NULL;
    dice_nat_event_t event = DICE_NAT_NONE;

    while (true) {
        if (xQueueReceive(sound_queue, &event, portMAX_DELAY) != pdTRUE)
            continue;
        // Initialize lazily: audio is optional and failure must not prevent
        // offline dice rolling, the screen, or battery recovery.
        if (!speaker) {
            speaker = bsp_audio_codec_speaker_init();
            if (!speaker) {
                ESP_LOGE(TAG, "Tab5 speaker initialization unavailable");
                continue;
            }
        } else if (bsp_feature_enable(BSP_FEATURE_SPEAKER, true) != ESP_OK) {
            ESP_LOGE(TAG, "Could not enable speaker amplifier");
            continue;
        }

        esp_codec_dev_sample_info_t format = {
            .sample_rate = DICE_TONE_SAMPLE_RATE,
            .channel = 1,
            .bits_per_sample = 16,
        };
        const int opened = esp_codec_dev_open(speaker, &format);
        if (opened != ESP_CODEC_DEV_OK) {
            ESP_LOGE(TAG, "Could not open ES8388 PCM stream: %d", opened);
            bsp_feature_enable(BSP_FEATURE_SPEAKER, false);
            continue;
        }
        const int volume = esp_codec_dev_set_out_vol(speaker, SPEAKER_VOLUME);
        if (volume != ESP_CODEC_DEV_OK) {
            ESP_LOGE(TAG, "Could not set safe speaker volume: %d", volume);
        } else if (!emit_notes(speaker, event)) {
            ESP_LOGW(TAG, "Critical cue was not completely played");
        }
        const int closed = esp_codec_dev_close(speaker);
        if (closed != ESP_CODEC_DEV_OK)
            ESP_LOGW(TAG, "Speaker stream close returned %d", closed);
        // The speaker amp is on the first expander, not the battery-charge
        // expander at I2C 0x44. Leave it off between critical rolls.
        if (bsp_feature_enable(BSP_FEATURE_SPEAKER, false) != ESP_OK)
            ESP_LOGW(TAG, "Could not disable idle speaker amplifier");
    }
}

bool dice_nat_sound_start(void) {
    if (sound_queue) return true;
    QueueHandle_t q = xQueueCreate(1, sizeof(dice_nat_event_t));
    if (!q) {
        ESP_LOGE(TAG, "Could not create critical audio queue");
        return false;
    }
    sound_queue = q;
    if (xTaskCreate(worker, "nat_audio", 4096, NULL, 4, NULL) != pdPASS) {
        ESP_LOGE(TAG, "Could not start critical audio worker");
        sound_queue = NULL;
        vQueueDelete(q);
        return false;
    }
    return true;
}

void dice_nat_sound_play(dice_nat_event_t event) {
    if (!sound_queue || (event != DICE_NAT_20 && event != DICE_NAT_1))
        return;
    // One-item mailbox avoids sound piling up; no waiting in LVGL.
    if (xQueueOverwrite(sound_queue, &event) != pdPASS)
        ESP_LOGW(TAG, "Critical audio queue refused event");
}
