#pragma once
#include "dice_nat_event.h"
#include <stddef.h>
#include <stdint.h>

// The Tab5 BSP initializes I2S at 48 kHz by default.
#define DICE_TONE_SAMPLE_RATE 48000u

typedef enum {
    DICE_TONE_TRUMPET = 0,
    DICE_TONE_BOO = 1,
} dice_tone_style_t;
typedef struct {
    uint16_t frequency_hz;      // Starting fundamental.
    uint16_t end_frequency_hz;  // Final fundamental (same = steady note).
    uint16_t duration_ms;
    dice_tone_style_t style;
} dice_tone_note_t;

// Immutable local cue score; no assets, external service, or dice RNG.
size_t dice_nat_tone_notes(dice_nat_event_t event,
                           const dice_tone_note_t **notes);
int16_t dice_nat_tone_sample(const dice_tone_note_t *note,
                             uint32_t frame, uint32_t frames);
