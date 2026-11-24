vec3 tonemap(vec3 rgb) {
    float m = max(rgb.r, max(rgb.g, rgb.b));
    return rgb * toneCurve(m) / m;
}
