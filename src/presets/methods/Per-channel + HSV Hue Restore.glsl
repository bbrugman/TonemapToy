vec3 tonemap(vec3 rgb) {
    float mx = max(rgb.r, max(rgb.g, rgb.b));
    float mn = min(rgb.r, min(rgb.g, rgb.b));
    float newMax = toneCurve(mx);
    float newMin = toneCurve(mn);
    return ((rgb - mn) / (mx - mn + 0.0001)) * (newMax - newMin) + newMin;
}
