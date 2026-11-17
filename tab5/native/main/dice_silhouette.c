#include "dice_silhouette.h"

static const uint8_t d4[][2]={{50,8},{91,88},{9,88}};
static const uint8_t d6[][2]={{50,8},{90,27},{90,72},{50,94},{10,73},{10,27}};
static const uint8_t d8[][2]={{50,5},{95,50},{50,95},{5,50}};
static const uint8_t d10[][2]={{50,5},{83,17},{95,49},{76,80},{50,97},
                               {23,80},{5,49},{17,17}};
static const uint8_t d12[][2]={{50,5},{76,12},{93,31},{96,57},{78,83},
                               {50,95},{22,83},{4,57},{7,31},{24,12}};
static const uint8_t d20[][2]={{50,5},{89,23},{96,67},{71,91},
                               {29,91},{4,67},{11,23}};
typedef struct {const uint8_t(*p)[2];int count;uint32_t light,mid,dark;} shape_t;
static shape_t shape_for(uint8_t sides,bool discarded) {
 shape_t s={d20,7,0xED6679,0xBD3249,0x7A2436};
 switch(sides){
  case 4:s=(shape_t){d4,3,0xEAC06F,0xB67932,0x75501E};break;
  case 6:s=(shape_t){d6,6,0x74C1E5,0x347EB1,0x204E79};break;
  case 8:s=(shape_t){d8,4,0xB5A0E9,0x7955B8,0x493475};break;
  case 10:s=(shape_t){d10,8,0x79CBA6,0x358E71,0x215C4A};break;
  case 12:s=(shape_t){d12,10,0xE4A77C,0xBC623B,0x783823};break;
  case 100:s=(shape_t){d10,8,0xE9CF79,0xB78A35,0x685226};break;
  default:break;
 }
 if(discarded){s.light=0x81909A;s.mid=0x52616D;s.dark=0x35404B;}
 return s;
}
static lv_point_precise_t vertex(const lv_area_t *a,const uint8_t p[2]){
 return (lv_point_precise_t){
  .x=a->x1+lv_area_get_width(a)*p[0]/100,
  .y=a->y1+lv_area_get_height(a)*p[1]/100
 };
}
void dice_silhouette_draw(lv_layer_t *layer,const lv_area_t *area,
                          uint8_t sides,bool discarded){
 if(!layer||!area)return;
 const shape_t shape=shape_for(sides,discarded);
 const uint8_t center[2]={50,50};
 const lv_point_precise_t c=vertex(area,center);
 for(int i=0;i<shape.count;++i){
  const lv_point_precise_t a=vertex(area,shape.p[i]);
  const lv_point_precise_t b=vertex(area,shape.p[(i+1)%shape.count]);
  lv_draw_triangle_dsc_t tri;lv_draw_triangle_dsc_init(&tri);
  tri.p[0]=c;tri.p[1]=a;tri.p[2]=b;
  tri.color=lv_color_hex(i%3==0?shape.light:i%3==1?shape.mid:shape.dark);
  tri.opa=LV_OPA_COVER;lv_draw_triangle(layer,&tri);
  lv_draw_line_dsc_t edge;lv_draw_line_dsc_init(&edge);
  edge.p1=a;edge.p2=b;edge.color=lv_color_hex(0x151D2B);
  edge.width=3;edge.opa=LV_OPA_COVER;lv_draw_line(layer,&edge);
 }
}
