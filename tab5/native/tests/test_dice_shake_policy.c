#include "../main/dice_shake_policy.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static void sample(dice_shake_policy_t *s, unsigned *t, float x,
                   float y, float z, bool rolled) {
    *t+=40;
    assert(dice_shake_policy_sample(s,x,y,z,*t)==rolled);
}
static void rest(dice_shake_policy_t *s, unsigned *t) {
    for(int i=0;i<7;i++)sample(s,t,0,0,1,false);
}
int main(void) {
    dice_shake_policy_t s;unsigned t=0;
    dice_shake_policy_init(&s);
    assert(!dice_shake_policy_sample(NULL,0,0,1,0));
    assert(!dice_shake_policy_sample(&s,NAN,0,1,0));
    rest(&s,&t);
    assert(s.armed);
    // Ordinary light handling doesn't trigger a roll.
    for(int i=0;i<30;i++)sample(&s,&t,.12f,0, .99f,false);
    // One physical back-and-forth gesture rolls once.
    sample(&s,&t, .85f,0,1,false);
    sample(&s,&t, .60f,0,1,false);
    sample(&s,&t,-.85f,0,1,true);
    for(int i=0;i<25;i++)
        sample(&s,&t,i%2?.75f:-.75f,0,1,false);
    // Cooldown plus stable rest permits the next single shake.
    rest(&s,&t);
    while(t-s.last_trigger_ms < 1850u)sample(&s,&t,0,0,1,false);
    sample(&s,&t,0,.8f,1,false);
    sample(&s,&t,0,-.8f,1,true);
    // A single bump isn't a full shake.
    dice_shake_policy_init(&s);rest(&s,&t);
    sample(&s,&t,.8f,0,1,false);
    for(int i=0;i<25;i++)sample(&s,&t,.1f,0,1,false);
    // Slow reversal outside 850ms window does not roll.
    dice_shake_policy_init(&s);rest(&s,&t);
    sample(&s,&t,0,.7f,1,false);
    for(int i=0;i<25;i++)sample(&s,&t,0,.1f,1,false);
    sample(&s,&t,0,-.7f,1,false);
    // Stationary noise and slow tilts stay below trigger.
    dice_shake_policy_init(&s);rest(&s,&t);
    for(int i=0;i<30;i++)sample(&s,&t,.15f*sin(i*.1f),0,1,false);
    puts("Tab5 one-shake reversal and cooldown tests passed");
}
