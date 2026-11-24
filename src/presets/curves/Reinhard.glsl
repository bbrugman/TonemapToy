uniform float WhitePoint; // logrange min=1.0 max=1000.0 default=32.0

float toneCurve(float t) {
    t = max(t, 0.);
    return min((1. + t / pow(WhitePoint, 2.)) * (t / (1. + t)), 1.);
}
