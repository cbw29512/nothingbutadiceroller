#include "../main/tab5_recovery_policy.h"
#include <assert.h>
#include <stdio.h>

int main(void) {
    // During the user's 30s recovery request, low monitor readings
    // do not immediately rule out an electrically protected pack.
    assert(tab5_recovery_probe_voltage_safe(1014));
    assert(tab5_recovery_probe_voltage_safe(6000));
    assert(tab5_recovery_probe_voltage_safe(8400));
    assert(tab5_recovery_probe_voltage_safe(8450));
    assert(!tab5_recovery_probe_voltage_safe(8451));
    assert(!tab5_recovery_probe_voltage_safe(9000));

    // Only charger-OFF voltage can qualify an attached 2S pack.
    assert(!tab5_recovery_pack_visible_with_charger_off(1014));
    assert(!tab5_recovery_pack_visible_with_charger_off(5499));
    assert(tab5_recovery_pack_visible_with_charger_off(5500));
    assert(tab5_recovery_pack_visible_with_charger_off(7400));
    assert(tab5_recovery_pack_visible_with_charger_off(8400));
    assert(!tab5_recovery_pack_visible_with_charger_off(9000));
    assert(TAB5_RECOVERY_PROBE_MS == 30000);
    assert(TAB5_RECOVERY_SETTLE_MS == 2000);
    puts("Tab5 manual battery recovery policy passed");
    return 0;
}
