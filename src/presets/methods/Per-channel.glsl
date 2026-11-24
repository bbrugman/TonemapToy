vec3 tonemap(vec3 rgb) {
    return vec3(toneCurve(rgb.r), toneCurve(rgb.g), toneCurve(rgb.b));
}
