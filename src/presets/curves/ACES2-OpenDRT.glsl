/*
    OpenDRT tone scale, also used by ACES 2.
*/

// ACES 2 parameters as defaults
uniform float OpenDRT_Contrast; // range min=1.0 max=2.0 default=1.15
uniform float OpenDRT_Toe; // range min=0.0 max=0.1 default=0.04
uniform float WhitePoint; // logrange min=1.0 max=1000.0 default=128.0

float openDRTCurve(float t) {
    t = max(t, 0.);
    t = pow(t / (1. + t), OpenDRT_Contrast); // "hyperbolic power"
    t = pow(t, 2.) / (t + OpenDRT_Toe); // quadratic toe compression
    return t;
}

float toneCurve(float t) {
    return openDRTCurve(t) / openDRTCurve(WhitePoint);
}
