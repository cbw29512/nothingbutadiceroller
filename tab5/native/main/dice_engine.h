#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define DICE_MAX 32
typedef enum { DICE_CHOOSE = 0, DICE_CONFIRM, DICE_SESSION } dice_phase_t;
typedef enum { DICE_NORMAL = 0, DICE_ADV, DICE_DIS } dice_mode_t;
typedef struct {
    dice_phase_t phase;
    dice_mode_t mode;
    int selected_system; // 0=D&D; additional verified profiles follow.
    uint8_t pool[DICE_MAX]; // Each entry is the number of sides.
    uint8_t count;
    uint16_t faces[DICE_MAX]; // Die outcome, separate from visual movement.
    int32_t modifier;
    int32_t total;
    bool has_result;
} dice_state_t;

typedef uint32_t (*dice_rng_t)(void);

void dice_state_reset(dice_state_t *state);
bool dice_select(dice_state_t *state, int system);
bool dice_confirm(dice_state_t *state);
bool dice_add(dice_state_t *state, uint8_t sides);
void dice_clear(dice_state_t *state);
bool dice_roll(dice_state_t *state, dice_rng_t rng);
uint32_t dice_unbiased(uint32_t sides, dice_rng_t rng);
