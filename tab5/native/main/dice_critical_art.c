#include "dice_critical_art.h"

static lv_point_precise_t pt(int x, int y) {
    return (lv_point_precise_t){.x=x, .y=y};
}
static void tri(lv_layer_t *layer, int x1,int y1,int x2,int y2,
                int x3,int y3,uint32_t color) {
    lv_draw_triangle_dsc_t d;
    lv_draw_triangle_dsc_init(&d);
    d.p[0]=pt(x1,y1);d.p[1]=pt(x2,y2);d.p[2]=pt(x3,y3);
    d.color=lv_color_hex(color);
    d.opa=LV_OPA_COVER;
    lv_draw_triangle(layer,&d);
}
static void stroke(lv_layer_t *layer,int x1,int y1,int x2,int y2,
                   uint32_t color,uint16_t width) {
    lv_draw_line_dsc_t d;
    lv_draw_line_dsc_init(&d);
    d.p1=pt(x1,y1);d.p2=pt(x2,y2);
    d.color=lv_color_hex(color);
    d.opa=LV_OPA_COVER;d.width=width;
    lv_draw_line(layer,&d);
}

static void dragon(lv_layer_t *layer,const lv_area_t *area,unsigned frame) {
    const int w=lv_area_get_width(area),h=lv_area_get_height(area);
    const int s=(w<h?w:h)/7;
    const int x=area->x1+w/2-s/2;
    const int y=area->y1+h/5;
    // Angular dragon silhouette: spread wings, horns, snout, glowing eye.
    tri(layer,x-s,y,x,y+s/3,x-s/2,y-s,0x783713);
    tri(layer,x-s/2,y-s,x+s/3,y+s/4,x+s/5,y-s/2,0xBA4E16);
    tri(layer,x-s/3,y,x+s/2,y-s/3,x+s/2,y+s/3,0xD6761C);
    tri(layer,x+s/4,y-s/3,x+s/3,y-s,x+s/2,y-s/3,0xF2AA24);
    tri(layer,x+s/2,y-s/3,x+s/2,y-s,x+s*2/3,y-s/4,0xF2AA24);
    tri(layer,x+s/2,y-s/5,x+s,y,x+s/2,y+s/4,0xCB5214);
    tri(layer,x+s*3/4,y-s/8,x+s,y,x+s*3/4,y+s/10,0xF5AF25);
    stroke(layer,x+s/2,y-s/10,x+s*3/5,y-s/10,0xF3FD56,4);
    // Fire fans from the muzzle and expands on each screen pulse.
    const int reach=s + (int)(frame%6)*s/9;
    const int mouth=x+s;
    for(int i=0;i<4;++i) {
        const int dy=(i-2)*s/5;
        tri(layer,mouth,y,mouth+reach,y+dy,
            mouth+s/2,y+dy/3,i%2?0xFF4E15:0xFFE14E);
    }
}
static void shattered(lv_layer_t *layer,const lv_area_t *area,unsigned frame) {
    const int w=lv_area_get_width(area),h=lv_area_get_height(area);
    const int s=(w<h?w:h)/8;
    const int x=area->x1+w/2,y=area->y1+h/5;
    const int shift=(int)(frame%7)*s/14;
    // An angular cracked d20 and diverging pieces for the NAT 1 screen.
    tri(layer,x-s,y,x,y-s,x-s/6,y,0xA51C31);
    tri(layer,x+s,y,x+s/7,y-s,x+s/5,y+s/4,0xEF4450);
    tri(layer,x-s,y,x-s/6,y,x-s/3,y+s,0x781020);
    tri(layer,x+s,y,x+s/5,y+s/4,x+s/3,y+s,0xC4273C);
    stroke(layer,x,y-s,x-s/6,y,0xFFDEDE,5);
    stroke(layer,x-s/6,y,x+s/5,y+s/4,0xFFDEDE,5);
    stroke(layer,x+s/5,y+s/4,x+s/9,y+s,0xFFDEDE,5);
    tri(layer,x-s-shift,y-s/3,x-s-shift-s/3,y-s/2,
        x-s-shift-s/4,y,0xFF7B65);
    tri(layer,x+s+shift,y-s/2,x+s+shift+s/3,y-s/3,
        x+s+shift+s/5,y,0xFFB1AC);
}
void dice_critical_art_draw(lv_event_t *event) {
    if (!event) return;
    const dice_critical_art_t *art=lv_event_get_user_data(event);
    lv_layer_t *layer=lv_event_get_layer(event);
    lv_obj_t *object=lv_event_get_target(event);
    if (!art || !layer || !object) return;
    lv_area_t area;
    lv_obj_get_coords(object,&area);
    if (art->event == DICE_NAT_20) dragon(layer,&area,art->frame);
    else if (art->event == DICE_NAT_1) shattered(layer,&area,art->frame);
}
