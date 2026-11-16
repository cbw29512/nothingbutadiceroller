#include "dice_shapes.h"
#include "dice_mesh.h"
#include "dice_project.h"
#include "dice_silhouette.h"
#include <string.h>

#define SHAPE_SLOTS 64
typedef struct {
 lv_obj_t *owner;
 uint8_t sides;
 bool discarded,mesh;
 int pitch,yaw,roll;
} die_shape_state_t;
static die_shape_state_t slots[SHAPE_SLOTS];
static uint32_t color_for(uint8_t sides,bool discarded) {
 if(discarded)return 0x81909A;
 switch(sides) {
  case 4:return 0xEAC06F;case 6:return 0x74C1E5;
  case 8:return 0xB5A0E9;case 10:return 0x79CBA6;
  case 12:return 0xE4A77C;case 20:return 0xED6679;
  case 100:return 0xE9CF79;default:return 0x81909A;
 }
}
static uint32_t shade_color(uint32_t color,uint8_t shade) {
 const uint32_t r=((color>>16)&255u)*shade/255u;
 const uint32_t g=((color>>8)&255u)*shade/255u;
 const uint32_t b=(color&255u)*shade/255u;
 return r<<16|g<<8|b;
}
static lv_point_precise_t pixel(const lv_area_t *area,int x,int y) {
 return (lv_point_precise_t){.x=area->x1+x,.y=area->y1+y};
}
static void draw_mesh(lv_layer_t *layer,const lv_area_t *area,
                      const die_shape_state_t *state) {
 dice_mesh_t mesh;
 dice_projection_t projected;
 if(!dice_mesh_make(state->sides,&mesh) ||
    !dice_project_mesh(&mesh,state->pitch,state->yaw,state->roll,
                       lv_area_get_width(area),&projected)) {
  dice_silhouette_draw(layer,area,state->sides,state->discarded);
  return;
 }
 const uint32_t base=color_for(state->sides,state->discarded);
 for(unsigned i=0;i<projected.count;++i) {
  const dice_project_face_t *face=&projected.faces[i];
  const uint32_t filled=shade_color(base,face->shade);
  // Convex face triangulation; painter-sorted faces are provided by projector.
  for(unsigned j=1;j+1<face->corners;++j){
   lv_draw_triangle_dsc_t tri;lv_draw_triangle_dsc_init(&tri);
   tri.p[0]=pixel(area,face->x[0],face->y[0]);
   tri.p[1]=pixel(area,face->x[j],face->y[j]);
   tri.p[2]=pixel(area,face->x[j+1],face->y[j+1]);
   tri.color=lv_color_hex(filled);tri.opa=LV_OPA_COVER;
   lv_draw_triangle(layer,&tri);
  }
  for(unsigned j=0;j<face->corners;++j) {
   const unsigned next=(j+1)%face->corners;
   lv_draw_line_dsc_t edge;lv_draw_line_dsc_init(&edge);
   edge.p1=pixel(area,face->x[j],face->y[j]);
   edge.p2=pixel(area,face->x[next],face->y[next]);
   edge.color=lv_color_hex(state->discarded?0x36404A:0x202631);
   edge.opa=LV_OPA_COVER;
   edge.width=lv_area_get_width(area)>165?3:2;
   lv_draw_line(layer,&edge);
  }
 }
}
static void on_draw(lv_event_t *event) {
 const die_shape_state_t *state=lv_event_get_user_data(event);
 lv_layer_t *layer=lv_event_get_layer(event);
 lv_obj_t *object=lv_event_get_target(event);
 if(!state||!state->owner||!object||!layer)return;
 lv_area_t area;lv_obj_get_coords(object,&area);
 if(state->mesh) draw_mesh(layer,&area,state);
 else dice_silhouette_draw(layer,&area,state->sides,state->discarded);
}
static void on_delete(lv_event_t *event) {
 die_shape_state_t *state=lv_event_get_user_data(event);
 if(state)memset(state,0,sizeof(*state));
}
void dice_shapes_attach(lv_obj_t *object,uint8_t sides,bool discarded) {
 if(!object)return;
 for(unsigned i=0;i<SHAPE_SLOTS;++i){
  die_shape_state_t *slot=&slots[i];
  if(slot->owner)continue;
  *slot=(die_shape_state_t){.owner=object,.sides=sides,
                            .discarded=discarded,.mesh=false};
  lv_obj_add_event_cb(object,on_draw,LV_EVENT_DRAW_MAIN,slot);
  lv_obj_add_event_cb(object,on_delete,LV_EVENT_DELETE,slot);
  return;
 }
}
void dice_shapes_set_tumble(lv_obj_t *object,bool enabled,
                            int pitch,int yaw,int roll) {
 if(!object)return;
 for(unsigned i=0;i<SHAPE_SLOTS;++i){
  die_shape_state_t *slot=&slots[i];
  if(slot->owner!=object)continue;
  slot->mesh=enabled;slot->pitch=pitch;
  slot->yaw=yaw;slot->roll=roll;
  lv_obj_invalidate(object);
  return;
 }
}
