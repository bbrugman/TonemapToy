/*
    Derived from the film curve equation given by Hurter & Driffield (1890).
    TODO: write something explaining this.
*/

uniform float FilmPrint_NegativeGamma; // logrange min=0.1 max=10.0 default=0.6
uniform float FilmPrint_PrintGamma; // logrange min=0.1 max=10.0 default=3.2

float toneCurve(float t) {
    return pow(
        1.0 + pow(
            max(t, 0.) / FilmPrint_NegativeGamma,
            -FilmPrint_NegativeGamma
        ) / FilmPrint_PrintGamma,
        -FilmPrint_PrintGamma
    );
}
