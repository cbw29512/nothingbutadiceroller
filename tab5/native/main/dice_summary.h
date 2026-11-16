#pragma once
#include "dice_engine.h"
#include <stdbool.h>
#include <stddef.h>

// A selection string always tells the user whether ROLL has happened yet.
bool dice_summary_format(const dice_state_t *state, char *buf, size_t capacity);
