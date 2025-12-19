let shaders = {
    "Minimal":
`
vec3 tonemap(vec3 x) {
    return x;
}
`,
    "Multi":
`
/*
For the shader to work, you must provide a function called "tonemap", 
taking linear Rec. 709 input (already scaled by exposure) as a vec3 
and returning linear Rec. 709 output as a vec3.

Any uniform you specify will receive its own UI control, labeled by 
the uniform name. Comments immediately after the uniform definition 
may be used to customize the control, depending on the type.

For ints or uints,
// choices <choice1> [choice2] [...]
creates a selector, where the n-th option yields value n-1.
The first option will be selected by default.

For floats, 
// range min=<min> max=<max>
creates a range input with the indicated bounds.

To specify a default value (except for selectors),
specify the "default=" option, e.g.
// range min=0 max=10 default=3.14

Booleans are true by default, but
// default=0
// default=false
// default=no
all change the default value to false.

This example shader shows off a few tonemappers and demonstrates what 
is possible.
*/

uniform int Curve; // choices Clamp Exponential Hurter_&_Driffield_(1890) AgX_Approx
uniform int Approach; // choices Per-channel Value AgX Helium
uniform float HD_Gamma; // range min=0.1 max=10.0 default=1.0
uniform float LogContrast; // range min=-3.0 max=3.0 default=0.0
uniform float AgX_RotateR; // range min=-0.99 max=0.99 default=0.0
uniform float AgX_InsetR; // range min=0.0 max=1.0
uniform float AgX_RotateG; // range min=-0.99 max=0.99
uniform float AgX_InsetG; // range min=0.0 max=1.0
uniform float AgX_RotateB; // range min=-0.99 max=0.99
uniform float AgX_InsetB; // range min=0.0 max=1.0
uniform bool Helium_SoftScale; // default=1
uniform bool ShowExtraClamp; // default=0

#define saturate(x) clamp(x, 0.0, 1.0)
#define APPLY(x, c) vec3(c(x.r), c(x.g), c(x.b))

float clampCurve(float x) {
    return min(x, 1.0);
}

float exponentialCurve(float x) {
    return 1.0 - exp(-x);
}

float perfectFilmCurve(float x) {
    /*
    This curve deserves more elaboration than fits here.
    It's a "perfect film characteristic curve", derived from a formula
    given by the inventors of film characteristic curves, Hurter & 
    Driffield, in 1890(!). When plotted on the digital equivalent of 
    such a chart, it has an infinite "linear portion" with slope 
    proportional to the gamma parameter. For gamma=1, it reduces to 
    the well-known curve from Reinhard (2002), who did not cite H&D.
    */
    return 1.0 - pow(1.0 + x/HD_Gamma, -HD_Gamma);
}

// Adapted from https://iolite-engine.com/blog_posts/minimal_agx_implementation
float agxDefaultContrastApprox(float x) {
    float x2 = x * x;
    float x4 = x2 * x2;
  
    return + 15.5   * x4 * x2
           - 40.14  * x4 * x
           + 31.96  * x4
           - 6.868  * x2 * x
           + 0.4298 * x2
           + 0.1191 * x
           - 0.00232;
}

float agxCurve(float x) {
    const float minE = -12.47393;
    const float maxE = 4.026069;
    x = clamp(log2(x), minE, maxE);
    x = (x - minE) / (maxE - minE);
    x = agxDefaultContrastApprox(x);
    // AgX curve was tuned for sRGB already
    return pow(x, 2.2); 
}

float luminance(vec3 linearRGB) {
    // Assuming Rec. 709 primaries
    const vec3 luminanceCoefs = vec3(0.2126, 0.7125, 0.0722);
    return dot(luminanceCoefs, linearRGB);
}

vec3 rgbSweep(float hue) {
    vec3 color = cos((hue - vec3(0.0, 1.0, 2.0)) * 3.141592 * 2.0 / 3.0);
    float maxRGB = max(color.r, max(color.g, color.b));
    float minRGB = min(color.r, min(color.g, color.b));
  
    return (color - minRGB) / (maxRGB - minRGB);
}

float selectedCurve(float x) {
    if (Curve == 0) return clampCurve(x);
    if (Curve == 1) return exponentialCurve(x);
    if (Curve == 2) return perfectFilmCurve(x);
    if (Curve == 3) return agxCurve(x);
}

vec3 tonemap(vec3 x) {
    // Clamp out-of-gamut colors
    x = max(x, 0.0); 

    x = 0.5*pow(2.0*x, vec3(exp(LogContrast)));

    if (Approach == 0) {
        x = APPLY(x, selectedCurve);
    } else if (Approach == 1) {
        float maxVal = max(x.r, max(x.g, x.b));
        float target = selectedCurve(maxVal);
        x = x * (target / maxVal);
    } else if (Approach == 2) {
        const vec3 sum1Gray = vec3(1.0 / 3.0);

        vec3 primaryR = mix(vec3(1.0 - abs(AgX_RotateR), max(0.0, -AgX_RotateR), max(0.0, AgX_RotateR)), sum1Gray, AgX_InsetR);
        vec3 primaryG = mix(vec3(max(0.0, AgX_RotateG), 1.0 - abs(AgX_RotateG), max(0.0, -AgX_RotateG)), sum1Gray, AgX_InsetG);
        vec3 primaryB = mix(vec3(max(0.0, -AgX_RotateB), max(0.0, AgX_RotateB), 1.0 - abs(AgX_RotateB)), sum1Gray, AgX_InsetB);

        mat3 agxMatrix = transpose(mat3(primaryR, primaryG, primaryB));
        mat3 agxMatrixInverse = inverse(agxMatrix);

        x = agxMatrix * x;
        x = APPLY(x, selectedCurve);
        x = agxMatrixInverse * x;
    } else if (Approach == 3) {
        const vec3 white = vec3(1.0, 1.0, 1.0);

        float lum = luminance(x);
        float targetLum = selectedCurve(lum);

        // Scale input to within the output cube
        float maxVal = max(x.r, max(x.g, x.b));
        float scale;
        if (Helium_SoftScale) {
            scale = selectedCurve(maxVal) / maxVal;
        } else {
            scale = min(targetLum / lum, min(1.0, maxVal) / maxVal);
        }
        vec3 scaled = scale * x;

        // Calculate target luminance not accounted for by scaled input
        float scaledLum = scale * lum;
        float missingLum = targetLum - scaledLum;

        // Move towards white for missing luminance
        vec3 toWhite = white - scaled;
        float toWhiteLum = 1.0 - scaledLum;
        x = scaled + (missingLum/toWhiteLum)*toWhite;
    }

    if (ShowExtraClamp) {
        if (min(x.r, min(x.g, x.b)) < -0.001 || max(x.r, max(x.g, x.b)) > 1.001) return vec3(1.0, 0.0, 1.0);
    }

    return x;
}
`,
};

for (const [key, value] of Object.entries(shaders)) {
    shaders[key] = value.trimStart();
}

export default shaders;
