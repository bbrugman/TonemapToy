/*
    Sort-of just the minimal tone scaling of OpenDRT.
*/

uniform float OpenDRT_Contrast; // range min=1.0 max=2.0 default=1.66
uniform float OpenDRT_Toe; // range min=0.0 max=0.1 default=0.003
uniform float WhitePoint; // logrange min=1.0 max=1000.0 default=32.0

float openDRTCurve(float t) {
    t = pow(t / (1. + t), OpenDRT_Contrast); // "hyperbolic power"
    t = pow(t, 2.) / (t + OpenDRT_Toe); // quadratic toe compression
    return t;
}

float toneCurve(float t) {
    return openDRTCurve(t) / openDRTCurve(WhitePoint);
}
