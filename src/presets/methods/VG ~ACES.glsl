/*
    In the video game industry, many use the words "ACES tonemapping"
    or "ACES Filmic" to refer to the ACES 1.x sRGB Output Transform
    or some kind of approximation thereof.
    While some engines implement relatively accurate approximations,
    sometimes "ACES tone mapping" just means applying a curve per-channel
    in (approximate) linear AP1 rather than in linearized display space,
    skipping all other RRT and ODT steps.
    This is the case in Godot, for example.
*/

const mat3 Rec709_to_AP1 = mat3(
    0.613164477, 0.339466431, 0.047369092,
    0.070204699, 0.916347730, 0.013447572,
    0.020623075, 0.109585185, 0.869791740
); // CAT02 chromatic adaptation from ACEScg
const mat3 AP1_to_Rec709 = inverse(Rec709_to_AP1);

vec3 tonemap(vec3 rgb) {
    rgb *= Rec709_to_AP1;
    rgb = vec3(toneCurve(rgb.r), toneCurve(rgb.g), toneCurve(rgb.b));
    rgb *= AP1_to_Rec709;
    return rgb;
}
