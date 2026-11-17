#include "dice_nat_tone.h"

// Original, self-contained sounds: three ascending victory notes and
// three descending warning notes. No file, network or sound library.
static const dice_tone_note_t victory[] = {
    {523, 135}, {659, 135}, {784, 150}, {1047, 230}
};
static const dice_tone_note_t failure[] = {
    {440, 170}, {311, 190}, {196, 250}
};

size_t dice_nat_tone_notes(dice_nat_event_t event,
                           const dice_tone_note_t **notes) {
    if (!notes) return 0;
    *notes = NULL;
    if (event == DICE_NAT_20) {
        *notes = victory;
        return sizeof(victory) / sizeof(victory[0]);
    }
    if (event == DICE_NAT_1) {
        *notes = failure;
        return sizeof(failure) / sizeof(failure[0]);
    }
    return 0;
}

int16_t dice_nat_tone_sample(uint16_t frequency_hz,
                             uint32_t frame, uint32_t frames) {
    if (!frequency_hz || !frames || frame >= frames) return 0;

    // Low-cost triangle wave with an attack/release envelope: the small
    // speaker stays at a bounded amplitude without hard clicks.
    const uint32_t cycle = (uint32_t)(
        ((uint64_t)frame * frequency_hz * 65536u /
         DICE_TONE_SAMPLE_RATE) & 0xffffu);
    const int32_t triangle = cycle < 32768u ?
        (int32_t)(cycle * 2u) - 32768 :
        98304 - (int32_t)(cycle * 2u);
    int32_t sample = triangle * 3800 / 32768;

    // 10ms attack, 25ms release, both capped at unity.
    const uint32_t attack = frame < 160u ? frame : 160u;
    const uint32_t remaining = frames - frame;
    const uint32_t release = remaining < 400u ? remaining : 400u;
    sample = sample * (int32_t)attack / 160;
    sample = sample * (int32_t)release / 400;
    return (int16_t)sample;
}
