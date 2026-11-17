#pragma once
#include <stdbool.h>

// Match the factory firmware's inactive state for the power-off pulse.
// Never issue a high pulse or command a device shutdown.
bool tab5_board_poweroff_idle_init(void);
