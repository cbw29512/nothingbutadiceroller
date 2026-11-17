#include "../main/dice_shake_policy.h"
#include "../main/dice_engine.h"
#include "../main/dice_controls.h"
#include <assert.h>
#include <stdio.h>

static uint32_t value(void) { return 17; }
static bool motion(dice_shake_policy_t *p, uint32_t *t, float x) {
    *t+=40;
    return dice_shake_policy_sample(p,x,0,1,*t);
}
int main(void) {
    dice_state_t s;
    dice_state_reset(&s);
    assert(dice_select(&s,0));
    assert(dice_confirm(&s));
    // Tap D6 twice: selection only, no RNG and no result yet.
    assert(dice_apply_control(&s,6)==DICE_CONTROL_REDRAW);
    assert(dice_apply_control(&s,6)==DICE_CONTROL_REDRAW);
    assert(s.count==2 && s.pool[0]==6 && s.pool[1]==6);
    assert(!s.has_result);
    dice_shake_policy_t shake;dice_shake_policy_init(&shake);
    uint32_t t=0;
    for(int i=0;i<7;i++)assert(!motion(&shake,&t,0));
    assert(!motion(&shake,&t,.8f));
    assert(motion(&shake,&t,-.8f));
    // Production UI receives true and calls existing roll_start() once.
    assert(dice_roll(&s,value));
    assert(s.has_result && s.count==2);
    assert(s.faces[0]==6 && s.faces[1]==6 && s.total==12);
    for(int i=0;i<30;i++)assert(!motion(&shake,&t,i%2?.8f:-.8f));
    // Reuse selected pool for next shake without new button taps.
    for(int i=0;i<45;i++)assert(!motion(&shake,&t,0));
    assert(!motion(&shake,&t,.8f));
    assert(motion(&shake,&t,-.8f));
    assert(dice_roll(&s,value));
    assert(s.count==2 && s.total==12);
    puts("Selected D6+D6 survives one-shake rolls and cooldown");
}
