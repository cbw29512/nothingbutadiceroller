#pragma once
#include "dice_engine.h"

// Screen spectacle only. Never changes an actual D&D roll or its meaning.
typedef enum {
    DICE_NAT_NONE = 0,
    DICE_NAT_20,
    DICE_NAT_1
} dice_nat_event_t;

// Uses selected visible d20 faces; discarded ADV/DIS faces never trigger.
dice_nat_event_t dice_nat_event_detect(const dice_state_t *state);
