#include "dice_impact_audio.h"

int16_t dice_impact_audio_sample(bool landing, uint32_t frame,
                                 uint32_t total_frames) {
    if (!total_frames || frame >= total_frames) return 0;
    // Fixed pseudo-noise for a wooden/resin clack: it is sound texture,
    // never used as a source of randomness for game outcomes.
    uint32_t noise = (frame + 1u) * UINT32_C(0x9e3779b9);
    noise ^= noise >> 16;
    noise *= UINT32_C(0x7feb352d);
    noise ^= noise >> 15;
    const int32_t noisy = (int32_t)(noise & 0xffffu) - 32768;

    // A low resonant landing and higher-pitched sharp contacts.
    const uint32_t freq = landing ? 240u : 1120u;
    const uint32_t cycle = (uint32_t)(
        ((uint64_t)frame * freq * 65536u / DICE_IMPACT_RATE) & 0xffffu);
    const int32_t triangle = cycle < 32768u ?
        (int32_t)(cycle * 2u) - 32768 :
        98304 - (int32_t)(cycle * 2u);
    int32_t sound = landing ? triangle / 12 + noisy / 40 :
                              triangle / 28 + noisy / 16;
    // 3ms soft attack and exponential-like tail; no large sample buffers.
    const uint32_t attack = frame < 144u ? frame : 144u;
    sound = sound * (int32_t)attack / 144;
    sound = sound * (int32_t)(total_frames-frame) / (int32_t)total_frames;
    return (int16_t)sound;
}
