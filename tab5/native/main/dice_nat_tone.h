#pragma once
#include "dice_nat_event.h"
#include <stddef.h>
#include <stdint.h>

#define DICE_TONE_SAMPLE_RATE 16000u

typedef struct {
    uint16_t frequency_hz;
    uint16_t duration_ms;
} dice_tone_note_t;

// Deterministic, original PCM cues; independent of the hardware dice RNG.
size_t dice_nat_tone_notes(dice_nat_event_t event,
                           const dice_tone_note_t **notes);
int16_t dice_nat_tone_sample(uint16_t frequency_hz,
                             uint32_t frame, uint32_t frames);
