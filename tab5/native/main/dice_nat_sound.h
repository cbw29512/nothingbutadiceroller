#pragma once
#include "dice_nat_event.h"
#include <stdbool.h>

// Called after display/power initialization; never blocks LVGL.
// Returns false if the isolated audio worker could not be created.
bool dice_nat_sound_start(void);

// Queues at most one critical-roll cue; called only on dice settle.
void dice_nat_sound_play(dice_nat_event_t event);

// Best-effort contact cue; never queues if audio already has pending work.
void dice_nat_sound_impact(bool landing);
