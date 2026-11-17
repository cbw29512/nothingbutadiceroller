#pragma once
#include <stdbool.h>
#include <stdint.h>

// BMI270 readings in g. Pure gesture policy; never owns dice or UI state.
// One human shake = one acceleration impulse and the reverse movement.
typedef struct {
    float gravity_x, gravity_y, gravity_z;
    float impulse_x, impulse_y, impulse_z;
    uint32_t first_ms, last_trigger_ms;
    uint8_t calm_samples;
    bool initialized, armed, waiting_reverse, has_triggered;
} dice_shake_policy_t;

void dice_shake_policy_init(dice_shake_policy_t *policy);
bool dice_shake_policy_sample(dice_shake_policy_t *policy,
                              float x, float y, float z, uint32_t now_ms);
