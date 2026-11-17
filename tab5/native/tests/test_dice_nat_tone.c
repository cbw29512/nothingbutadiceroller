#include "../main/dice_nat_tone.h"
#include <assert.h>
#include <stdio.h>
#include <stdint.h>

static void check(dice_nat_event_t event, bool ascending) {
    const dice_tone_note_t *notes = NULL;
    const size_t count = dice_nat_tone_notes(event, &notes);
    assert(count >= 2 && count <= 5 && notes);
    unsigned duration = 0;
    for (size_t i = 0; i < count; ++i) {
        assert(notes[i].frequency_hz >= 150);
        assert(notes[i].frequency_hz <= 1500);
        if (i) {
            if (ascending)
                assert(notes[i].frequency_hz > notes[i - 1].frequency_hz);
            else
                assert(notes[i].frequency_hz < notes[i - 1].frequency_hz);
        }
        duration += notes[i].duration_ms;
        const uint32_t frames = notes[i].duration_ms *
                                DICE_TONE_SAMPLE_RATE / 1000u;
        int16_t max_abs = 0;
        assert(dice_nat_tone_sample(notes[i].frequency_hz, 0, frames) == 0);
        assert(dice_nat_tone_sample(notes[i].frequency_hz, frames,
                                   frames) == 0);
        for (uint32_t frame = 0; frame < frames; ++frame) {
            const int16_t sample =
                dice_nat_tone_sample(notes[i].frequency_hz, frame, frames);
            const int16_t abs_sample = sample < 0 ? -sample : sample;
            if (abs_sample > max_abs) max_abs = abs_sample;
            assert(abs_sample <= 3800);
        }
        assert(max_abs > 200);
    }
    // Short, bounded feedback cannot become a prolonged jingle.
    assert(duration >= 400 && duration <= 800);
}
int main(void) {
    check(DICE_NAT_20, true);
    check(DICE_NAT_1, false);
    const dice_tone_note_t *notes = (void*)0x1;
    assert(dice_nat_tone_notes(DICE_NAT_NONE, &notes) == 0);
    assert(notes == NULL);
    assert(dice_nat_tone_notes(DICE_NAT_20, NULL) == 0);
    assert(dice_nat_tone_sample(0, 1, 1600) == 0);
    assert(dice_nat_tone_sample(440, 1, 0) == 0);
    puts("Tab5 bounded original NAT20/NAT1 speaker cue tests passed");
    return 0;
}
