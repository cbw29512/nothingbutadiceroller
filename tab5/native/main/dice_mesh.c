#include "dice_mesh.h"
#include <string.h>

#define F3(a,b,c) {3,{a,b,c}}
#define F4(a,b,c,d) {4,{a,b,c,d}}
#define F5(a,b,c,d,e) {5,{a,b,c,d,e}}
static const dice_vec3_t tetra[] = {
 {1,1,1},{-1,-1,1},{-1,1,-1},{1,-1,-1}
};
static const dice_mesh_face_t tf[] = {
 F3(0,1,2),F3(0,3,1),F3(0,2,3),F3(1,3,2)
};
static const dice_vec3_t cube[] = {
 {-1,-1,-1},{1,-1,-1},{1,1,-1},{-1,1,-1},
 {-1,-1,1},{1,-1,1},{1,1,1},{-1,1,1}
};
static const dice_mesh_face_t cf[] = {
 F4(0,1,2,3),F4(4,5,6,7),F4(0,4,5,1),
 F4(1,5,6,2),F4(2,6,7,3),F4(3,7,4,0)
};
static const dice_vec3_t octa[] = {
 {0,0,1},{0,0,-1},{1,0,0},{0,1,0},{-1,0,0},{0,-1,0}
};
static const dice_mesh_face_t of[] = {
 F3(0,2,3),F3(0,3,4),F3(0,4,5),F3(0,5,2),
 F3(1,3,2),F3(1,4,3),F3(1,5,4),F3(1,2,5)
};
// True planar pentagonal trapezohedron: five upper and five lower kites.
// Apex height = h*(1+cos(36deg))/(1-cos(36deg)); h=.1, radius=1.
// Both pairs of equal-length kite edges now lie in a single plane.
static const dice_vec3_t deca[] = {
 {0,0,.9472136f},{0,0,-.9472136f},
 {1,0,.1f},{.30901699f,.95105652f,.1f},{-.80901699f,.58778525f,.1f},
 {-.80901699f,-.58778525f,.1f},{.30901699f,-.95105652f,.1f},
 {.80901699f,.58778525f,-.1f},{-.30901699f,.95105652f,-.1f},
 {-1,0,-.1f},{-.30901699f,-.95105652f,-.1f},
 {.80901699f,-.58778525f,-.1f}
};
static const dice_mesh_face_t df[] = {
 F4(0,2,7,3),F4(0,3,8,4),F4(0,4,9,5),
 F4(0,5,10,6),F4(0,6,11,2),
 F4(1,7,3,8),F4(1,8,4,9),F4(1,9,5,10),
 F4(1,10,6,11),F4(1,11,2,7)
};
static const dice_vec3_t ico[] = {
 {-1,1.618034f,0},{1,1.618034f,0},{-1,-1.618034f,0},
 {1,-1.618034f,0},{0,-1,1.618034f},{0,1,1.618034f},
 {0,-1,-1.618034f},{0,1,-1.618034f},{1.618034f,0,-1},
 {1.618034f,0,1},{-1.618034f,0,-1},{-1.618034f,0,1}
};
static const dice_mesh_face_t icof[] = {
 F3(0,11,5),F3(0,5,1),F3(0,1,7),F3(0,7,10),F3(0,10,11),
 F3(1,5,9),F3(5,11,4),F3(11,10,2),F3(10,7,6),F3(7,1,8),
 F3(3,9,4),F3(3,4,2),F3(3,2,6),F3(3,6,8),F3(3,8,9),
 F3(4,9,5),F3(2,4,11),F3(6,2,10),F3(8,6,7),F3(9,8,1)
};
// Dodecahedron: the geometric dual of the icosahedron above.
// Each vertex is one normalized icosahedron face center.
static const dice_vec3_t dodeca[] = {
 {-.57735f,.57735f,.57735f},{0,.93417f,.35682f},
 {0,.93417f,-.35682f},{-.57735f,.57735f,-.57735f},
 {-.93417f,.35682f,0},{.57735f,.57735f,.57735f},
 {-.35682f,0,.93417f},{-.93417f,-.35682f,0},
 {-.35682f,0,-.93417f},{.57735f,.57735f,-.57735f},
 {.57735f,-.57735f,.57735f},{0,-.93417f,.35682f},
 {0,-.93417f,-.35682f},{.57735f,-.57735f,-.57735f},
 {.93417f,-.35682f,0},{.35682f,0,.93417f},
 {-.57735f,-.57735f,.57735f},{-.57735f,-.57735f,-.57735f},
 {.35682f,0,-.93417f},{.93417f,.35682f,0}
};
static const dice_mesh_face_t dodf[] = {
 F5(0,1,2,3,4),F5(1,5,19,9,2),F5(11,16,7,17,12),
 F5(10,11,12,13,14),F5(15,6,16,11,10),F5(6,15,5,1,0),
 F5(13,12,17,8,18),F5(3,2,9,18,8),F5(19,14,13,18,9),
 F5(5,15,10,14,19),F5(7,4,3,8,17),F5(16,6,0,4,7)
};
#undef F3
#undef F4
#undef F5
#define SELECT(v,f) do { vertices=(v); faces=(f); vc=sizeof(v)/sizeof((v)[0]); fc=sizeof(f)/sizeof((f)[0]); } while(0)
bool dice_mesh_make(uint8_t sides, dice_mesh_t *output) {
 if (!output) return false;
 const dice_vec3_t *vertices=NULL;
 const dice_mesh_face_t *faces=NULL;
 size_t vc=0,fc=0;
 switch (sides) {
  case 4: SELECT(tetra,tf); break;
  case 6: SELECT(cube,cf); break;
  case 8: SELECT(octa,of); break;
  case 10: case 100: SELECT(deca,df); break;
  case 12: SELECT(dodeca,dodf); break;
  case 20: SELECT(ico,icof); break;
  default: return false;
 }
 if (vc>DICE_MESH_MAX_VERTICES || fc>DICE_MESH_MAX_FACES) return false;
 memset(output,0,sizeof(*output));
 output->vertices_count=(uint8_t)vc;output->faces_count=(uint8_t)fc;
 memcpy(output->vertices,vertices,vc*sizeof(*vertices));
 memcpy(output->faces,faces,fc*sizeof(*faces));
 return true;
}
#undef SELECT
