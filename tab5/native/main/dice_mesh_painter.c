#include "dice_mesh_painter.h"
#include "dice_mesh.h"
#include "dice_project.h"

static uint32_t base_color(uint8_t sides, bool discarded) {
 if(discarded)return 0x81909A;
 switch(sides){
  case 4:return 0xEAC06F;case 6:return 0x74C1E5;
  case 8:return 0xB5A0E9;case 10:return 0x79CBA6;
  case 12:return 0xE4A77C;case 20:return 0xED6679;
  default:return 0xE9CF79;
 }
}
static uint32_t shade_color(uint32_t color,uint8_t shade){
 const uint32_t r=((color>>16)&255u)*shade/255u;
 const uint32_t g=((color>>8)&255u)*shade/255u;
 const uint32_t b=(color&255u)*shade/255u;
 return r<<16|g<<8|b;
}
static lv_point_precise_t pixel(const lv_area_t *a,int x,int y){
 return (lv_point_precise_t){.x=a->x1+x,.y=a->y1+y};
}
static void draw_face_number(lv_layer_t *layer,const lv_area_t *area,
                             const dice_project_face_t *face,const char *text){
 if(!text||!text[0])return;
 int x=0,y=0,xlo=32767,xhi=-32768,ylo=32767,yhi=-32768;
 for(unsigned j=0;j<face->corners;++j){
  const int px=face->x[j],py=face->y[j];
  x+=px;y+=py;
  if (px < xlo) xlo = px;
  if (px > xhi) xhi = px;
  if (py < ylo) ylo = py;
  if (py > yhi) yhi = py;
 }
 if(xhi-xlo<31 || yhi-ylo<26)return; // Too edge-on to read.
 x/=face->corners;y/=face->corners;
 const int width=xhi-xlo>64?52:33;
 lv_area_t text_area={
  .x1=area->x1+x-width/2,.y1=area->y1+y-14,
  .x2=area->x1+x+width/2,.y2=area->y1+y+14
 };
 lv_draw_label_dsc_t desc;lv_draw_label_dsc_init(&desc);
 desc.text=text; // Persistent state storage; task may draw asynchronously.
 desc.font=width==52?&lv_font_montserrat_28:&lv_font_montserrat_20;
 desc.color=lv_color_hex(face->shade<158?0xFFFFFF:0x152538);
 desc.align=LV_TEXT_ALIGN_CENTER;desc.opa=LV_OPA_COVER;
 lv_draw_label(layer,&desc,&text_area);
}
bool dice_mesh_paint(lv_layer_t *layer,const lv_area_t *area,uint8_t sides,
                     bool discarded,int pitch,int yaw,int roll,
                     const char face_text[20][4]){
 if(!layer||!area||!face_text)return false;
 dice_mesh_t mesh;dice_projection_t projected;
 if(!dice_mesh_make(sides,&mesh) ||
    !dice_project_mesh(&mesh,pitch,yaw,roll,
                       lv_area_get_width(area),&projected))return false;
 const uint32_t base=base_color(sides,discarded);
 for(unsigned i=0;i<projected.count;++i){
  const dice_project_face_t *face=&projected.faces[i];
  const uint32_t filled=shade_color(base,face->shade);
  for(unsigned j=1;j+1<face->corners;++j){
   lv_draw_triangle_dsc_t triangle;lv_draw_triangle_dsc_init(&triangle);
   triangle.p[0]=pixel(area,face->x[0],face->y[0]);
   triangle.p[1]=pixel(area,face->x[j],face->y[j]);
   triangle.p[2]=pixel(area,face->x[j+1],face->y[j+1]);
   triangle.color=lv_color_hex(filled);triangle.opa=LV_OPA_COVER;
   lv_draw_triangle(layer,&triangle);
  }
  for(unsigned j=0;j<face->corners;++j){
   const unsigned next=(j+1)%face->corners;
   lv_draw_line_dsc_t edge;lv_draw_line_dsc_init(&edge);
   edge.p1=pixel(area,face->x[j],face->y[j]);
   edge.p2=pixel(area,face->x[next],face->y[next]);
   edge.color=lv_color_hex(discarded?0x36404A:0x202631);
   edge.opa=LV_OPA_COVER;edge.width=lv_area_get_width(area)>165?3:2;
   lv_draw_line(layer,&edge);
  }
  draw_face_number(layer,area,face,face_text[face->source_index]);
 }
 return true;
}
void dice_mesh_paint_fallback_number(lv_layer_t *layer,const lv_area_t *area,
                                     const char *text){
 if(!layer||!area||!text||!text[0])return;
 lv_area_t label=*area;
 label.y1=(area->y1+area->y2)/2-14;
 label.y2=label.y1+28;
 lv_draw_label_dsc_t desc;lv_draw_label_dsc_init(&desc);
 desc.text=text;desc.font=&lv_font_montserrat_20;
 desc.color=lv_color_hex(0xFFFFFF);desc.align=LV_TEXT_ALIGN_CENTER;
 desc.opa=LV_OPA_COVER;lv_draw_label(layer,&desc,&label);
}
