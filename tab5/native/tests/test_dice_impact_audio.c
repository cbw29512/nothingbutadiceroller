#include "../main/dice_impact_audio.h"
#include <assert.h>
#include <stdio.h>

static void check(bool landing) {
    const uint32_t frames = (landing ? DICE_LANDING_MS : DICE_CLACK_MS)
                            * DICE_IMPACT_RATE / 1000u;
    int maximum = 0;
    assert(dice_impact_audio_sample(landing, 0, frames) == 0);
    assert(dice_impact_audio_sample(landing, frames, frames) == 0);
    for (uint32_t i=0; i<frames; ++i) {
        const int16_t sample=dice_impact_audio_sample(landing,i,frames);
        const int amplitude=sample<0?-sample:sample;
        if (amplitude>maximum) maximum=amplitude;
        assert(amplitude<=3800);
        assert(sample == dice_impact_audio_sample(landing,i,frames));
    }
    assert(maximum>400);
}
int main(void) {
    check(false);
    check(true);
    assert(dice_impact_audio_sample(false,100,0)==0);
    puts("Tab5 bounded collision and final landing PCM tests passed");
    return 0;
}
