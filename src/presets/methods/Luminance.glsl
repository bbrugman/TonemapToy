/*
    "Luminance-based tone mapping."

    This method is often said to "preserve hue," but it does not
    actually preserve RGB ratios once you take the necessary final
    clamp to display range into account.
*/

vec3 tonemap(vec3 rgb) {
    float lum = dot(rgb, vec3(0.2126, 0.7125, 0.0722));
    return rgb * toneCurve(lum) / lum;
}
