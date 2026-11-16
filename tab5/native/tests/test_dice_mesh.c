#include "../main/dice_mesh.h"
#include "../main/dice_project.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static void check_shape(uint8_t sides,unsigned corners,unsigned faces){
 dice_mesh_t mesh;
 assert(dice_mesh_make(sides,&mesh));
 assert(mesh.vertices_count==corners&&mesh.faces_count==faces);
 for(unsigned i=0;i<mesh.faces_count;++i){
  const dice_mesh_face_t *face=&mesh.faces[i];
  assert(face->corners>=3&&face->corners<=DICE_MESH_MAX_CORNERS);
  for(unsigned j=0;j<face->corners;++j)
   assert(face->vertex[j]<mesh.vertices_count);
 }
 // The user can rotate the Tab5 at any point; projection never changes
 // the die's fixed source outcome and never draws outside a die widget.
 for(int pitch=0;pitch<=2700;pitch+=900){
  for(int yaw=0;yaw<=2700;yaw+=900){
   dice_projection_t projection;
   assert(dice_project_mesh(&mesh,pitch,yaw,430,200,&projection));
   assert(projection.count>=1&&projection.count<=mesh.faces_count);
   for(unsigned i=0;i<projection.count;++i){
    const dice_project_face_t *face=&projection.faces[i];
    assert(face->shade>=32&&face->shade<=255);
    if(i)assert(projection.faces[i-1].depth<=face->depth);
    for(unsigned j=0;j<face->corners;++j){
     assert(face->x[j]>=0&&face->x[j]<=200);
     assert(face->y[j]>=0&&face->y[j]<=200);
    }
   }
  }
 }
}
int main(void){
 check_shape(4,4,4);
 check_shape(6,8,6);
 check_shape(8,6,8);
 check_shape(10,12,10);
 check_shape(12,20,12);
 check_shape(20,12,20);
 check_shape(100,12,10);
 dice_mesh_t invalid={0}, mesh;
 dice_projection_t projected;
 assert(!dice_mesh_make(7,&mesh));
 assert(!dice_mesh_make(20,NULL));
 assert(!dice_project_mesh(NULL,0,0,0,100,&projected));
 assert(!dice_project_mesh(&invalid,0,0,0,100,&projected));
 assert(!dice_project_mesh(&mesh,0,0,0,0,&projected));
 puts("Tab5 exact polygon face counts, perspective and rotation projections passed");
 return 0;
}
