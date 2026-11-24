/*
    Derived from the film curve equation given by Hurter & Driffield (1890).
    TODO: write something explaining this.
*/

uniform float ReversalFilm_Gamma; // logrange min=0.5 max=3.0 default=1.4

float toneCurve(float t) {
    return pow(1. - exp(-max(t, 0.)), ReversalFilm_Gamma);
}
