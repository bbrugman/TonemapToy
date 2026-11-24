/*
    AgX as in
    https://github.com/sobotka/AgX-Resolve
    though with parameterization differences driven by
    simplified color geometry math.
*/

uniform float RedAttenuation; // range min=0.001 max=0.999 default=0.30
uniform float GreenAttenuation; // range min=0.001 max=0.999 default=0.30
uniform float BlueAttenuation; // range min=0.001 max=0.999 default=0.15
uniform float RedHueFlight; // range min=-0.5 max=0.5 default=-0.05
uniform float GreenHueFlight; // range min=-0.5 max=0.5 default=0.04
uniform float BlueHueFlight; // range min=-0.5 max=0.5 default=0.08
uniform bool PurityEqAttenuation; // default=1
uniform float RedPurity; // range min=-1.0 max=0.999 default=0.30
uniform float GreenPurity; // range min=-1.0 max=0.999 default=0.30
uniform float BluePurity; // range min=-1.0 max=0.999 default=0.15

struct Chromaticities {
    vec2 red;
    vec2 green;
    vec2 blue;
    vec2 white;
};

mat3 RGB_to_XYZ(Chromaticities c) {
    mat3 M = mat3(
        c.red.x / c.red.y,
        c.green.x / c.green.y,
        c.blue.x / c.blue.y,
        1.,
        1.,
        1.,
        (1. - c.red.x - c.red.y) / c.red.y,
        (1. - c.green.x - c.green.y) / c.green.y,
        (1. - c.blue.x - c.blue.y) / c.blue.y
    );

    vec3 wb = vec3(
        c.white.x / c.white.y,
        1.,
        (1. - c.white.x - c.white.y) / c.white.y
    ) * inverse(M);

    return mat3(
        M[0] * wb,
        M[1] * wb,
        M[2] * wb
    );
}

mat3 conversionMatrix(Chromaticities a, Chromaticities b) {
    return RGB_to_XYZ(a) * inverse(RGB_to_XYZ(b));
}

Chromaticities rotatePrimaries(Chromaticities c, float r, float g, float b) {
    /*
        Instead of rotating the primaries around the achromatic point
        and finding the intersection of the line through the achromatic
        point and the rotated primary with the gamut boundary,
        here we directly slide the primaries across the boundary.
    */
    Chromaticities d = c;
    d.red = mix(c.red, r > 0. ? c.blue : c.green, max(r, -r));
    d.green = mix(c.green, g > 0. ? c.red : c.blue, max(g, -g));
    d.blue = mix(c.blue, b > 0. ? c.green : c.red, max(b, -b));
    return d;
}

Chromaticities insetPrimaries(Chromaticities c, float r, float g, float b) {
    Chromaticities d = c;
    d.red = mix(c.red, c.white, r);
    d.green = mix(c.green, c.white, g);
    d.blue = mix(c.blue, c.white, b);
    return d;
}

const Chromaticities Rec709 = Chromaticities(
    vec2(0.64, 0.33),
    vec2(0.3, 0.6),
    vec2(0.15, 0.06),
    vec2(0.3126, 0.329)
);

vec3 tonemap(vec3 rgb) {
    Chromaticities AgXBase = rotatePrimaries(Rec709, RedHueFlight, GreenHueFlight, BlueHueFlight);
    Chromaticities AgX = insetPrimaries(AgXBase, RedAttenuation, GreenAttenuation, BlueAttenuation);
    Chromaticities AgX2;
    if (PurityEqAttenuation) {
        AgX2 = AgX;
    } else {
        AgX2 = insetPrimaries(AgXBase, RedPurity, GreenPurity, BluePurity);
    }
    mat3 inset = conversionMatrix(AgX, Rec709);
    mat3 outset = conversionMatrix(Rec709, AgX2);

    rgb = rgb * inset;
    rgb = vec3(toneCurve(rgb.r), toneCurve(rgb.g), toneCurve(rgb.b));
    return rgb * outset;
}
