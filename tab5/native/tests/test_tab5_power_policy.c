#include "../main/tab5_power_policy.h"
#include <assert.h>
#include <stdio.h>

int main(void) {
    // INA226 1.25mV LSB, with bounded integer conversion.
    assert(tab5_power_decode_ina226_mv(0, 0) == 0);
    assert(tab5_power_decode_ina226_mv(0x12, 0xC0) == 6000);
    assert(tab5_power_decode_ina226_mv(0x18, 0x9C) == 7875);
    assert(tab5_power_decode_ina226_mv(0xFF, 0xFF) == 81919);
    assert(!tab5_power_pack_present_mv(0));
    assert(!tab5_power_pack_present_mv(2000)); // Empty battery bay.
    assert(!tab5_power_pack_present_mv(3999));
    assert(tab5_power_pack_present_mv(4000)); // Protected pack.
    assert(tab5_power_pack_present_mv(5500)); // Deep discharge.
    assert(tab5_power_pack_present_mv(6000));
    assert(tab5_power_pack_present_mv(8400)); // Fully charged 2S pack.
    assert(tab5_power_pack_present_mv(8800));
    assert(!tab5_power_pack_present_mv(8801));
    assert(!tab5_power_pack_present_mv(9000));
    puts("Tab5 power policy and INA226 conversion passed");
    return 0;
}
