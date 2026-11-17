#include "dice_critical_art.h"

// Deliberately abstract, legible critical feedback. No recognizable
// cartoon shapes, bitmaps, web assets, persistent widgets or extra buttons.
// Sixteen precomputed unit vectors avoid trigonometry on every LVGL frame.
static const int16_t directions[16][2] = {
    {1024,0}, {946,392}, {724,724}, {392,946},
    {0,1024}, {-392,946}, {-724,724}, {-946,392},
    {-1024,0}, {-946,-392}, {-724,-724}, {-392,-946},
    {0,-1024}, {392,-946}, {724,-724}, {946,-392}
};
static lv_point_precise_t point(int x, int y) {
    return (lv_point_precise_t){.x=x, .y=y};
}
static void line(lv_layer_t *layer, int x1, int y1, int x2, int y2,
                 uint32_t color, uint8_t opacity, uint16_t width) {
    lv_draw_line_dsc_t draw;
    lv_draw_line_dsc_init(&draw);
    draw.p1=point(x1,y1);
    draw.p2=point(x2,y2);
    draw.color=lv_color_hex(color);
    draw.opa=opacity;
    draw.width=width;
    lv_draw_line(layer,&draw);
}
static void ring(lv_layer_t *layer, int x, int y, int radius,
                 uint32_t color, uint8_t opacity, uint16_t width) {
    for (unsigned i=0; i<16; ++i) {
        const unsigned next=(i+1u)%16u;
        const int x1=x+directions[i][0]*radius/1024;
        const int y1=y+directions[i][1]*radius/1024;
        const int x2=x+directions[next][0]*radius/1024;
        const int y2=y+directions[next][1]*radius/1024;
        line(layer,x1,y1,x2,y2,color,opacity,width);
    }
}
void dice_critical_art_draw(lv_event_t *event) {
    if (!event) return;
    const dice_critical_art_t *art=lv_event_get_user_data(event);
    lv_layer_t *layer=lv_event_get_layer(event);
    lv_obj_t *object=lv_event_get_target(event);
    if (!art || !layer || !object ||
        (art->event != DICE_NAT_20 && art->event != DICE_NAT_1))
        return;

    lv_area_t area;
    lv_obj_get_coords(object,&area);
    const int w=lv_area_get_width(&area);
    const int h=lv_area_get_height(&area);
    const int x=area.x1+w/2;
    const int y=area.y1+h/2-100; // Halo sits behind the existing numeral.
    const unsigned f=art->frame>19u?19u:art->frame;
    const bool victory=art->event==DICE_NAT_20;
    const uint32_t main_color=victory?0xFFD84A:0xFF5E7B;
    const uint32_t secondary=victory?0xE7FF00:0xFF9AAD;

    // NAT 20 expands in two clean, concentric shockwaves.
    // NAT 1 collapses inward: the opposite motion is immediately legible.
    const int outer=victory?82+(int)f*10:240-(int)f*8;
    const int inner=victory?54+(int)f*7:176-(int)f*6;
    const uint8_t fade=(uint8_t)(180u-(f*7u));
    ring(layer,x,y,outer,main_color,fade,4);
    ring(layer,x,y,inner,secondary,(uint8_t)(fade/2u),2);

    // Eight sparse light streaks are abstract energy, not illustrations.
    // They stay behind the labels and occupy no permanent screen space.
    for (unsigned i=0; i<16; i+=2) {
        const int near=outer+9;
        const int far=near+(victory?36:20);
        line(layer,x+directions[i][0]*near/1024,
                   y+directions[i][1]*near/1024,
                   x+directions[i][0]*far/1024,
                   y+directions[i][1]*far/1024,
                   secondary,(uint8_t)(fade/2u),victory?3:2);
    }
}
