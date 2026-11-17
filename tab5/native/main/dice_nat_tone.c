#include "dice_nat_tone.h"

// Original short trumpet call: three rising pickups then a held high
// victory note, using a bright, brassy harmonic oscillator.
static const dice_tone_note_t victory[] = {
    {392, 392, 100, DICE_TONE_TRUMPET},
    {523, 523, 115, DICE_TONE_TRUMPET},
    {659, 659, 125, DICE_TONE_TRUMPET},
    {784, 784, 135, DICE_TONE_TRUMPET},
    {1047, 1047, 260, DICE_TONE_TRUMPET}
};

// One long, falling, slightly buzzy "booooo" rather than generic error beeps.
static const dice_tone_note_t boo[] = {
    {310, 180, 850, DICE_TONE_BOO}
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
        *notes = boo;
        return sizeof(boo) / sizeof(boo[0]);
    }
    return 0;
}

// One bipolar 16-bit triangle cycle without calling libm per sample.
static int32_t triangle(uint32_t phase) {
    phase &= 0xffffu;
    return phase < 32768u ?
        (int32_t)(phase * 2u) - 32768 :
        98304 - (int32_t)(phase * 2u);
}

int16_t dice_nat_tone_sample(const dice_tone_note_t *note,
                             uint32_t frame, uint32_t frames) {
    if (!note || !note->frequency_hz || !frames || frame >= frames)
        return 0;

    // Integrate a linear frequency glide. Phase stays continuous, unlike
    // recomputing each sample from the instantaneous frequency.
    const int64_t delta =
        (int64_t)note->end_frequency_hz - note->frequency_hz;
    const int64_t cycles =
        (int64_t)note->frequency_hz * frame +
        delta * frame * frame / (2 * (int64_t)frames);
    const uint32_t phase =
        (uint32_t)(((uint64_t)cycles * 65536u /
                    DICE_TONE_SAMPLE_RATE) & 0xffffu);

    const int32_t base = triangle(phase);
    const int32_t second = triangle(phase * 2u);
    const int32_t third = triangle(phase * 3u);
    int32_t mixed;

    if (note->style == DICE_TONE_BOO) {
        // Hollow human-vowel-like timbre plus a low 5 Hz volume wobble.
        // This is a cartoon synthesized BOOO, not recorded speech.
        const uint32_t wobble = (frame / (DICE_TONE_SAMPLE_RATE / 10u)) % 2u;
        mixed = (base * 7 + second * 2 + third) / 10;
        mixed = mixed * (wobble ? 88 : 100) / 100;
    } else {
        // Extra harmonics make a lightweight brass-style fanfare.
        mixed = (base * 5 + second * 3 + third * 2) / 10;
    }

    // Hard-bound the PCM peak to 3800/32767 before codec volume 35%.
    int32_t sample = mixed * 3800 / 32768;
    const uint32_t attack_frames =
        note->style == DICE_TONE_BOO ? 1440u : 480u;
    const uint32_t release_frames =
        note->style == DICE_TONE_BOO ? 5760u : 1920u;
    const uint32_t remaining = frames - frame;
    const uint32_t attack = frame < attack_frames ? frame : attack_frames;
    const uint32_t release =
        remaining < release_frames ? remaining : release_frames;
    sample = sample * (int32_t)attack / (int32_t)attack_frames;
    sample = sample * (int32_t)release / (int32_t)release_frames;
    return (int16_t)sample;
}
