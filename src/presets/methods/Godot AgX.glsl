/*
    AgX using the Blender AgX matrices.
    Blender's AgX includes "guard rails" omitted here,
    as in Godot.
*/
const mat3 Rec709_to_AgX = mat3(
    0.544814746488245, 0.140416948464053, 0.0888104196149096,
    0.373787398372697, 0.754137554567394, 0.178871756420858,
    0.0813978551390581, 0.105445496968552, 0.732317823964232
);
const mat3 AgX_to_Rec709 = mat3(
    1.96488741169489, -0.299313364904742, -0.164352742528393,
    -0.855988495690215, 1.32639796461980, -0.238183969428088,
    -0.108898916004672, -0.0270845997150571, 1.40253671195648
);

vec3 tonemap(vec3 rgb) {
    rgb = Rec709_to_AgX * rgb;
    rgb = vec3(toneCurve(rgb.r), toneCurve(rgb.g), toneCurve(rgb.b));
    rgb = AgX_to_Rec709 * rgb;
    return rgb;
}
