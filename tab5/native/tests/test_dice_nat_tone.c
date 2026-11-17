#include "../main/dice_nat_tone.h"
#include <assert.h>
#include <stdio.h>
#include <stdint.h>

static void verify_cue(dice_nat_event_t event, dice_tone_style_t style) {
    const dice_tone_note_t *notes = NULL;
    const size_t count = dice_nat_tone_notes(event, &notes);
    assert(count > 0 && count <= 5 && notes);
    unsigned duration = 0;
    for (size_t i = 0; i < count; ++i) {
        const dice_tone_note_t *note = &notes[i];
        assert(note->style == style);
        assert(note->frequency_hz >= 150 && note->frequency_hz <= 1500);
        assert(note->end_frequency_hz >= 150 &&
               note->end_frequency_hz <= 1500);
        assert(note->duration_ms >= 80 && note->duration_ms <= 850);
        if (i && style == DICE_TONE_TRUMPET)
            assert(note->frequency_hz > notes[i - 1].frequency_hz);
        duration += note->duration_ms;
        const uint32_t frames =
            (uint32_t)note->duration_ms * DICE_TONE_SAMPLE_RATE / 1000u;
        assert(dice_nat_tone_sample(note, 0, frames) == 0);
        assert(dice_nat_tone_sample(note, frames, frames) == 0);
        int16_t max_abs = 0;
        for (uint32_t frame = 0; frame < frames; ++frame) {
            const int16_t sample = dice_nat_tone_sample(note, frame, frames);
            const int16_t amplitude = sample < 0 ? -sample : sample;
            if (amplitude > max_abs) max_abs = amplitude;
            assert(amplitude <= 3800);
        }
        assert(max_abs > 200);
    }
    assert(duration >= 500 && duration <= 1000);
    if (style == DICE_TONE_BOO) {
        assert(count == 1); // One long BOOO, not three descending beeps.
        assert(notes[0].end_frequency_hz < notes[0].frequency_hz);
        assert(notes[0].duration_ms >= 750);
    } else {
        assert(count >= 4);
        assert(notes[count - 1].duration_ms >= 200);
        for (size_t i = 0; i < count; ++i)
            assert(notes[i].end_frequency_hz == notes[i].frequency_hz);
    }
}
int main(void) {
    verify_cue(DICE_NAT_20, DICE_TONE_TRUMPET);
    verify_cue(DICE_NAT_1, DICE_TONE_BOO);
    const dice_tone_note_t *notes = (void *)0x1;
    assert(dice_nat_tone_notes(DICE_NAT_NONE, &notes) == 0);
    assert(notes == NULL);
    assert(dice_nat_tone_notes(DICE_NAT_20, NULL) == 0);
    const dice_tone_note_t bad = {0};
    assert(dice_nat_tone_sample(NULL, 1, 1600) == 0);
    assert(dice_nat_tone_sample(&bad, 1, 1600) == 0);
    assert(dice_nat_tone_sample(&bad, 1, 0) == 0);
    puts("Tab5 original trumpet and boo PCM envelopes passed");
    return 0;
}
