#include "tab5_power_policy.h"

bool tab5_power_pack_present_mv(uint32_t millivolts) {
    // Tab5 uses a removable 2S NP-F550 pack.
    // Empirical Tab5 absence reading is ~2V, while a protected pack is
    // normally >4V. Reject wild values rather than charging into no pack.
    return millivolts >= 4000 && millivolts <= 8800;
}
uint32_t tab5_power_decode_ina226_mv(uint8_t msb, uint8_t lsb) {
    const uint32_t raw = ((uint32_t)msb << 8) | lsb;
    // INA226 bus voltage LSB is 1.25mV; integer rounding to nearest mV.
    return (raw * 5u + 2u) / 4u;
}
int32_t tab5_power_decode_ina226_shunt_uv(uint8_t msb, uint8_t lsb) {
    const uint16_t raw = ((uint16_t)msb << 8) | lsb;
    // Sign-extend explicitly; avoid implementation-defined unsigned-to-signed casts.
    const int32_t signed_raw = raw & 0x8000 ? (int32_t)raw - 65536 : raw;
    return (signed_raw * 5) / 2;  // 2.5uV per LSB, truncate to whole uV.
}
