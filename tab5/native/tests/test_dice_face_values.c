#include "../main/dice_face_values.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int get(uint8_t sides,uint16_t result,unsigned face,bool tens){
 char text[4]={0};
 assert(dice_face_text(sides,result,(uint8_t)face,0,tens,
                       text,sizeof(text)));
 return atoi(text);
}
static void check_sides(uint8_t sides){
 const unsigned count=sides==100?10:sides;
 for(unsigned result=1;result<=sides;++result){
  bool seen[101]={0};
  for(unsigned face=0;face<count;++face){
   const int number=get(sides,(uint16_t)result,face,false);
   assert(number>=0&&number<=(int)sides);
   if(sides==100||sides==10)assert(number<10);
   else assert(number>=1);
   assert(!seen[number]);
   seen[number]=true;
  }
  if(sides==100){
   assert(get(sides,(uint16_t)result,0,true)==
          (result==100?0:(int)(result/10)*10%100));
   assert(get(sides,(uint16_t)result,0,false)==(int)(result%10));
   for(unsigned f=1;f<count;++f)
    assert(get(sides,(uint16_t)result,f,true)%10==0);
  }else if(sides==10){
   assert(get(sides,(uint16_t)result,0,false)==(int)(result%10));
  }else{
   assert(get(sides,(uint16_t)result,0,false)==(int)result);
  }
 }
}
int main(void){
 check_sides(4);check_sides(6);check_sides(8);
 check_sides(10);check_sides(12);check_sides(20);
 check_sides(100);
 char text[4]={0};
 assert(dice_face_text(100,100,0,0,true,text,sizeof(text)));
 assert(strcmp(text,"00")==0);
 assert(dice_face_text(100,100,0,0,false,text,sizeof(text)));
 assert(strcmp(text,"0")==0);
 assert(dice_face_text(100,7,0,0,true,text,sizeof(text)));
 assert(strcmp(text,"00")==0);
 assert(dice_face_text(100,7,0,0,false,text,sizeof(text)));
 assert(strcmp(text,"7")==0);
 assert(dice_face_text(100,56,0,0,true,text,sizeof(text)));
 assert(strcmp(text,"50")==0);
 assert(dice_face_text(100,56,0,0,false,text,sizeof(text)));
 assert(strcmp(text,"6")==0);
 assert(dice_face_text(10,10,0,0,false,text,sizeof(text)));
 assert(strcmp(text,"0")==0);
 assert(!dice_face_text(100,101,0,0,true,text,sizeof(text)));
 assert(!dice_face_text(8,9,0,0,true,text,sizeof(text)));
 assert(!dice_face_text(20,1,21,0,false,text,sizeof(text)));
 assert(!dice_face_text(20,1,0,21,false,text,sizeof(text)));
 assert(!dice_face_text(5,1,0,0,false,text,sizeof(text)));
 assert(!dice_face_text(6,1,0,0,false,NULL,4));
 puts("Tab5 face/result anchoring and all 100 percentile outcomes passed");
 return 0;
}
