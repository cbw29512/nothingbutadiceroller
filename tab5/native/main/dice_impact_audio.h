#pragma once
#include <stdbool.h>
#include <stdint.h>

#define DICE_IMPACT_RATE 48000u
#define DICE_CLACK_MS 42u
#define DICE_LANDING_MS 95u

// Deterministic short PCM impact, synchronized to physical simulation contacts.
int16_t dice_impact_audio_sample(bool landing, uint32_t frame,
                                 uint32_t total_frames);
