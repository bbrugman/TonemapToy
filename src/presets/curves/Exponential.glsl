float toneCurve(float t) {
    return 1. - exp(-max(t, 0.));
}
