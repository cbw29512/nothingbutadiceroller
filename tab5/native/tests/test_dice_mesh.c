#include "../main/dice_mesh.h"
#include "../main/dice_project.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static void verify_solid(uint8_t sides,unsigned corners,unsigned faces){
 dice_mesh_t mesh;
 assert(dice_mesh_make(sides,&mesh));
 assert(mesh.vertices_count==corners&&mesh.faces_count==faces);
 int edge_count[DICE_MESH_MAX_VERTICES][DICE_MESH_MAX_VERTICES]={0};
 for(unsigned i=0;i<mesh.faces_count;++i){
  const dice_mesh_face_t *face=&mesh.faces[i];
  assert(face->corners>=3&&face->corners<=DICE_MESH_MAX_CORNERS);
  for(unsigned j=0;j<face->corners;++j){
   const unsigned a=face->vertex[j],b=face->vertex[(j+1)%face->corners];
   assert(a<mesh.vertices_count&&b<mesh.vertices_count&&a!=b);
   edge_count[a<b?a:b][a<b?b:a]++;
  }
  // Flat planar faces required for real dice; the original d10 failed this.
  const dice_vec3_t a=mesh.vertices[face->vertex[0]];
  const dice_vec3_t b=mesh.vertices[face->vertex[1]];
  const dice_vec3_t c=mesh.vertices[face->vertex[2]];
  const float nx=(b.y-a.y)*(c.z-a.z)-(b.z-a.z)*(c.y-a.y);
  const float ny=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
  const float nz=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const float magnitude=sqrtf(nx*nx+ny*ny+nz*nz);
  assert(magnitude>.001f);
  for(unsigned j=3;j<face->corners;++j){
   const dice_vec3_t p=mesh.vertices[face->vertex[j]];
   const float distance=fabsf(nx*(p.x-a.x)+ny*(p.y-a.y)+nz*(p.z-a.z));
   assert(distance/magnitude<.001f);
  }
 }
 unsigned edges=0;
 for(unsigned i=0;i<mesh.vertices_count;++i)
  for(unsigned j=i+1;j<mesh.vertices_count;++j)
   if(edge_count[i][j]){assert(edge_count[i][j]==2);++edges;}
 // Euler formula for a closed, convex, genus-zero die surface.
 assert(mesh.vertices_count-edges+mesh.faces_count==2);
 int fp,fy;
 assert(dice_mesh_front_angles(&mesh,0,&fp,&fy));
 dice_projection_t front;
 assert(dice_project_mesh(&mesh,fp,fy,0,200,&front));
 assert(front.count>=1&&front.count<=mesh.faces_count);
 assert(front.faces[front.count-1].source_index==0);
 for(int pitch=0;pitch<=2700;pitch+=900){
  for(int yaw=0;yaw<=2700;yaw+=900){
   dice_projection_t projection;
   assert(dice_project_mesh(&mesh,pitch,yaw,430,200,&projection));
   assert(projection.count>=1&&projection.count<=mesh.faces_count);
   for(unsigned i=0;i<projection.count;++i){
    const dice_project_face_t *f=&projection.faces[i];
    assert(f->source_index<mesh.faces_count);
    assert(f->shade>=32&&f->shade<=255);
    if(i)assert(projection.faces[i-1].depth<=f->depth);
    for(unsigned j=0;j<f->corners;++j){
     assert(f->x[j]>=0&&f->x[j]<=200);
     assert(f->y[j]>=0&&f->y[j]<=200);
    }
   }
  }
 }
}
int main(void){
 verify_solid(4,4,4);
 verify_solid(6,8,6);
 verify_solid(8,6,8);
 verify_solid(10,12,10);
 verify_solid(12,20,12);
 verify_solid(20,12,20);
 verify_solid(100,12,10);
 dice_mesh_t invalid={0},mesh;
 dice_projection_t projected;
 assert(!dice_mesh_make(7,&mesh));
 assert(!dice_mesh_make(20,NULL));
 assert(!dice_project_mesh(NULL,0,0,0,100,&projected));
 assert(!dice_project_mesh(&invalid,0,0,0,100,&projected));
 assert(!dice_project_mesh(&mesh,0,0,0,0,&projected));
 assert(!dice_mesh_front_angles(NULL,0,NULL,NULL));
 puts("Tab5 authentic closed, coplanar polyhedra and aligned faces passed");
 return 0;
}
