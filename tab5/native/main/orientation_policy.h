#pragma once
#include <stdbool.h>

// Pure orientation policy; no LVGL, sensor driver, or display writes.
// Codes: 0=0 degrees, 1=90, 2=180, 3=270.
typedef struct {
    int current;
    int candidate;
    unsigned consistent_samples;
} orientation_policy_t;

void orientation_policy_init(orientation_policy_t *state, int initial);
bool orientation_policy_sample(orientation_policy_t *state,
                               float x, float y, float z, int *rotation);
