#pragma once
#include <stdbool.h>
#include <stdint.h>

// Pure IMU policy. Gravity is in units of g, time in monotonic milliseconds.
// Three distinct acceleration peaks must alternate with near-1g rest.
typedef struct {
    uint32_t window_ms;
    uint32_t last_trigger_ms;
    uint8_t peaks;
    uint8_t calm_samples;
    bool armed;
    bool peak_latched;
    bool has_triggered;
} dice_shake_policy_t;

void dice_shake_policy_init(dice_shake_policy_t *policy);
bool dice_shake_policy_sample(dice_shake_policy_t *policy,
                              float x, float y, float z, uint32_t now_ms);
