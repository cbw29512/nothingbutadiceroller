#include "../main/dice_label_fit.h"
#include <assert.h>
#include <stdio.h>

static dice_project_face_t square(void) {
    dice_project_face_t face = {.corners = 4};
    face.x[0]=0; face.y[0]=0;
    face.x[1]=100; face.y[1]=0;
    face.x[2]=100; face.y[2]=100;
    face.x[3]=0; face.y[3]=100;
    return face;
}

int main(void) {
    dice_project_face_t f = square();
    assert(dice_label_fits_face(&f, 50, 50, 30, 20));
    assert(!dice_label_fits_face(&f, 98, 50, 30, 20));
    assert(!dice_label_fits_face(&f, 50, 3, 30, 20));
    assert(!dice_label_fits_face(&f, 50, 50, 0, 20));
    assert(!dice_label_fits_face(NULL, 50, 50, 30, 20));

    // Works regardless of clockwise/counterclockwise winding.
    dice_project_face_t reversed = square();
    reversed.x[1]=0; reversed.y[1]=100;
    reversed.x[3]=100; reversed.y[3]=0;
    assert(dice_label_fits_face(&reversed, 50, 50, 20, 20));

    // Bounding-box-only labels would float over empty diamond corners.
    dice_project_face_t diamond = {.corners = 4};
    diamond.x[0]=50; diamond.y[0]=0;
    diamond.x[1]=100; diamond.y[1]=50;
    diamond.x[2]=50; diamond.y[2]=100;
    diamond.x[3]=0; diamond.y[3]=50;
    assert(dice_label_fits_face(&diamond, 50, 50, 20, 20));
    assert(!dice_label_fits_face(&diamond, 75, 75, 20, 20));

    // A narrow, tilted facet can have a large bounding rectangle while
    // being unable to contain even a small text label.
    dice_project_face_t triangle = {.corners = 3};
    triangle.x[0]=10; triangle.y[0]=10;
    triangle.x[1]=90; triangle.y[1]=10;
    triangle.x[2]=50; triangle.y[2]=80;
    assert(dice_label_fits_face(&triangle, 50, 35, 16, 16));
    assert(!dice_label_fits_face(&triangle, 30, 55, 25, 20));

    f.corners=2;
    assert(!dice_label_fits_face(&f,50,50,20,20));
    puts("Tab5 rolling numeral confinement to projected die faces passed");
    return 0;
}
