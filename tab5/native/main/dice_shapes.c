#include "dice_shapes.h"
#include "dice_face_values.h"
#include "dice_mesh.h"
#include "dice_mesh_painter.h"
#include "dice_project.h"
#include "dice_silhouette.h"
#include "esp_log.h"
#include <string.h>

#define SHAPE_SLOTS 64
typedef struct {
 lv_obj_t *owner;
 uint8_t sides;
 bool discarded,mesh;
 int pitch,yaw,roll,front_pitch,front_yaw;
 char face_text[2][20][4]; // Persistent through LVGL asynchronous draw.
} die_shape_state_t;
static die_shape_state_t slots[SHAPE_SLOTS];
static const char *TAG="dice_shapes";

static void draw_one(lv_layer_t *layer,const lv_area_t *region,
                     const die_shape_state_t *state,unsigned which){
 const uint8_t shape_sides=state->sides==100?10:state->sides;
 const char (*labels)[4]=state->face_text[which];
 if(state->mesh &&
    dice_mesh_paint(layer,region,shape_sides,state->discarded,
                    state->front_pitch+state->pitch,
                    state->front_yaw+state->yaw,
                    state->roll,labels))return;
 dice_silhouette_draw(layer,region,shape_sides,state->discarded);
 // A percentile roll is ALWAYS visibly two actual ten-sided dice.
 if(state->sides==100)
  dice_mesh_paint_fallback_number(layer,region,labels[0]);
}
static void on_draw(lv_event_t *event){
 const die_shape_state_t *state=lv_event_get_user_data(event);
 lv_layer_t *layer=lv_event_get_layer(event);
 lv_obj_t *object=lv_event_get_target(event);
 if(!state || state->owner!=object || !layer)return;
 lv_area_t area;lv_obj_get_coords(object,&area);
 if(state->sides!=100){
  draw_one(layer,&area,state,0);
  return;
 }
 const int w=lv_area_get_width(&area),h=lv_area_get_height(&area);
 int side=(w-8)/2;
 if(side>h-4)side=h-4;
 if(side<40) {ESP_LOGW(TAG,"Percentile die too small to draw");return;}
 // Two distinct d10 solids: tens marked 00/10/.../90 and units 0/.../9.
 const int left=area.x1+(w-(2*side+8))/2;
 const int y=area.y1+(h-side)/2;
 lv_area_t tens={.x1=left,.y1=y,.x2=left+side-1,.y2=y+side-1};
 lv_area_t units={.x1=left+side+8,.y1=y,
                  .x2=left+2*side+7,.y2=y+side-1};
 draw_one(layer,&tens,state,0);
 draw_one(layer,&units,state,1);
}
static void on_delete(lv_event_t *event){
 die_shape_state_t *state=lv_event_get_user_data(event);
 if(state)memset(state,0,sizeof(*state));
}
void dice_shapes_attach(lv_obj_t *object,uint8_t sides,
                        uint16_t outcome,bool discarded){
 if(!object)return;
 for(unsigned i=0;i<SHAPE_SLOTS;++i){
  die_shape_state_t *state=&slots[i];
  if(state->owner)continue;
  *state=(die_shape_state_t){.owner=object,.sides=sides,
                             .discarded=discarded,.mesh=false};
  const uint8_t shape_sides=sides==100?10:sides;
  dice_mesh_t m;
  if(!dice_mesh_make(shape_sides,&m) ||
     !dice_mesh_front_angles(&m,0,&state->front_pitch,&state->front_y)){
   ESP_LOGE(TAG,"Unsupported face geometry: d%u",(unsigned)sides);
   memset(state,0,sizeof(*state));
   return;
  }
  for(unsigned f=0;f<m.faces_count;++f){
   if(!dice_face_text(sides,outcome,(uint8_t)f,0,true,
                      state->face_text[0][f],4) ||
      (sides==100 &&
       !dice_face_text(sides,outcome,(uint8_t)f,0,false,
                       state->face_text[1][f],4))){
    ESP_LOGE(TAG,"Cannot map source face for d%u",(unsigned)sides);
    memset(state,0,sizeof(*state));
    return;
   }
  }
  lv_obj_add_event_cb(object,on_draw,LV_EVENT_DRAW_MAIN,state);
  lv_obj_add_event_cb(object,on_delete,LV_EVENT_DELETE,state);
  return;
 }
 ESP_LOGE(TAG,"No LVGL die shape slots remain");
}
void dice_shapes_set_tumble(lv_obj_t *object,bool enabled,
                            int pitch,int yaw,int roll){
 if(!object)return;
 for(unsigned i=0;i<SHAPE_SLOTS;++i){
  die_shape_state_t *state=&slots[i];
  if(state->owner!=object)continue;
  state->mesh=enabled;state->pitch=pitch;
  state->yaw=yaw;state->roll=roll;
  lv_obj_invalidate(object);
  return;
 }
}
bool dice_shapes_has_embedded_numbers(lv_obj_t *object){
 if(!object)return false;
 for(unsigned i=0;i<SHAPE_SLOTS;++i)
  if(slots[i].owner==object)return slots[i].mesh || slots[i].sides==100;
 return false;
}
