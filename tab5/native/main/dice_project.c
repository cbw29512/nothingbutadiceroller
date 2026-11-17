#include "dice_project.h"
#include <math.h>
#include <string.h>

static dice_vec3_t sub(dice_vec3_t a, dice_vec3_t b) {
 return (dice_vec3_t){a.x-b.x,a.y-b.y,a.z-b.z};
}
static dice_vec3_t cross(dice_vec3_t a, dice_vec3_t b) {
 return (dice_vec3_t){a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,
                       a.x*b.y-a.y*b.x};
}
static float dot(dice_vec3_t a, dice_vec3_t b) {
 return a.x*b.x+a.y*b.y+a.z*b.z;
}
static dice_vec3_t rotate(dice_vec3_t p,
                         float sx,float cx,float sy,float cy,float sz,float cz) {
 // Three independent rotational axes give proper changing 3D facets.
 dice_vec3_t x={p.x,cx*p.y-sx*p.z,sx*p.y+cx*p.z};
 dice_vec3_t y={cy*x.x+sy*x.z,x.y,-sy*x.x+cy*x.z};
 return (dice_vec3_t){cz*y.x-sz*y.y,sz*y.x+cz*y.y,y.z};
}
static uint8_t shade(float value) {
 if (value<.18f)value=.18f;
 if (value>1.0f)value=1.0f;
 return (uint8_t)(value*255.0f);
}
bool dice_mesh_front_angles(const dice_mesh_t *mesh, uint8_t face_index,
                            int *pitch, int *yaw) {
 if (!mesh || !pitch || !yaw || face_index >= mesh->faces_count) return false;
 const dice_mesh_face_t *f=&mesh->faces[face_index];
 if (f->corners<3 || f->vertex[0]>=mesh->vertices_count ||
     f->vertex[1]>=mesh->vertices_count ||
     f->vertex[2]>=mesh->vertices_count) return false;
 const dice_vec3_t a=mesh->vertices[f->vertex[0]];
 const dice_vec3_t b=mesh->vertices[f->vertex[1]];
 const dice_vec3_t c=mesh->vertices[f->vertex[2]];
 dice_vec3_t n=cross(sub(b,a),sub(c,a));
 const float len=sqrtf(dot(n,n));
 if (!(len>.001f) || !isfinite(len)) return false;
 if (dot(n,a)<0) {n.x=-n.x;n.y=-n.y;n.z=-n.z;}
 const float degrees=572.957795f; // radians to tenths of a degree
 *pitch=(int)roundf(atan2f(n.y,n.z)*degrees);
 *yaw=(int)roundf(atan2f(-n.x,sqrtf(n.y*n.y+n.z*n.z))*degrees);
 return true;
}
bool dice_project_mesh(const dice_mesh_t *mesh,
                       int pitch,int yaw,int roll,int size,
                       dice_projection_t *out) {
 if (!mesh || !out || size<40 || size>1024 ||
     mesh->vertices_count<4 || mesh->vertices_count>DICE_MESH_MAX_VERTICES ||
     mesh->faces_count<4 || mesh->faces_count>DICE_MESH_MAX_FACES) return false;
 memset(out,0,sizeof(*out));
 const float rad=0.0001745329252f; // deci-degree to radians
 const float ax=pitch*rad, ay=yaw*rad, az=roll*rad;
 const float sx=sinf(ax),cx=cosf(ax),sy=sinf(ay),cy=cosf(ay);
 const float sz=sinf(az),cz=cosf(az);
 dice_vec3_t v[DICE_MESH_MAX_VERTICES];
 float radius=0;
 for (unsigned i=0;i<mesh->vertices_count;++i) {
  const dice_vec3_t p=mesh->vertices[i];
  const float len=sqrtf(dot(p,p));
  if (!isfinite(len))return false;
  if (len>radius)radius=len;
  v[i]=rotate(p,sx,cx,sy,cy,sz,cz);
 }
 if (radius<.1f)return false;
 const float scale=size*.40f/radius;
 for (unsigned k=0;k<mesh->faces_count;++k) {
  const dice_mesh_face_t *f=&mesh->faces[k];
  if (f->corners<3 || f->corners>DICE_MESH_MAX_CORNERS) return false;
  for (unsigned j=0;j<f->corners;++j)
   if (f->vertex[j]>=mesh->vertices_count)return false;
  const dice_vec3_t a=v[f->vertex[0]],b=v[f->vertex[1]],c=v[f->vertex[2]];
  dice_vec3_t normal=cross(sub(b,a),sub(c,a));
  float mag=sqrtf(dot(normal,normal));
  if (mag<.001f || !isfinite(mag))return false;
  normal.x/=mag;normal.y/=mag;normal.z/=mag;
  // A mesh may list clockwise or counterclockwise. Force outward normals.
  if (dot(normal,a)<0){normal.x=-normal.x;normal.y=-normal.y;normal.z=-normal.z;}
  if (normal.z<.025f)continue; // Backface culling for convex die solids.
  dice_project_face_t face={0};
  face.corners=f->corners;
  face.source_index=(uint8_t)k;
  float depth=0;
  for (unsigned j=0;j<f->corners;++j) {
   const dice_vec3_t p=v[f->vertex[j]];
   // Mild perspective, bounded to avoid singularities.
   const float perspective=3.7f/(3.7f-p.z/radius*.35f);
   const float xx=size*.5f+p.x*scale*perspective;
   const float yy=size*.5f-p.y*scale*perspective;
   if (!isfinite(xx)||!isfinite(yy))return false;
   face.x[j]=(int16_t)xx;face.y[j]=(int16_t)yy;
   depth+=p.z;
  }
  face.depth=depth/(float)f->corners;
  const float light=normal.x*.28f+normal.y*.35f+normal.z*.89f;
  face.shade=shade(.35f+.65f*(light>0?light:0));
  // Painter's order: far faces first; nearest visible faces on top.
  int pos=out->count;
  while(pos>0&&out->faces[pos-1].depth>face.depth){
   out->faces[pos]=out->faces[pos-1];--pos;
  }
  out->faces[pos]=face;++out->count;
 }
 return out->count>0;
}
