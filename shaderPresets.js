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
or
// logrange min=<min> max=<max>
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

uniform int Curve; // choices Clamp Exponential Hurter_&_Driffield_(1890) Hable LogToeStraightShoulder
uniform int Approach; // choices Per-channel Value Luminance AgX Helium
uniform float HD_Gamma; // logrange min=0.1 max=10.0 default=1.0
uniform float Hable_WhitePoint; // logrange min=1.0 max=100.0 default=11.2
uniform float LTSS_StraightStartX; // logrange min=0.01 max=100.0 default=0.5
uniform float LTSS_StraightEndX; // logrange min=00.1 max=100.0 default=3.0
uniform float LTSS_StraightStartY; // range min=0.0 max=1.0 default=0.3
uniform float LTSS_StraightEndY; // range min=0.0 max=1.0 default=0.8
uniform float LogContrast; // range min=-3.0 max=3.0 default=0.0
uniform float AgX_RotateR; // range min=-0.99 max=0.99 default=0.001
uniform float AgX_InsetR; // range min=0.0 max=1.0 default=0.235
uniform float AgX_RotateG; // range min=-0.99 max=0.99 default=-0.042
uniform float AgX_InsetG; // range min=0.0 max=1.0 default=0.127
uniform float AgX_RotateB; // range min=-0.99 max=0.99 default=0.041
uniform float AgX_InsetB; // range min=0.0 max=1.0 default=0.127
uniform bool Helium_SmoothScale; // default=1
uniform bool Helium_AbneyComp; // default=1
uniform bool ShowExtraClamp; // default=0

#define saturate(x) clamp(x, 0.0, 1.0)
#define APPLY(x, c) vec3(c(x.r), c(x.g), c(x.b))

float clampCurve(float x) {
    return min(x, 1.0);
}

float exponentialCurve(float x) {
    return 1.0 - exp(-x);
}

float idealFilmCurve(float x) {
    /*
    This curve deserves more elaboration than fits here.
    It's derived from a formula given by the inventors of film 
    characteristic curves, Hurter & Driffield, in 1890(!).
    When plotted on the digital equivalent of such a chart, it 
    has an infinite "linear portion" with slope proportional to
    the gamma parameter. For gamma=1, it reduces to the well-
    known curve from Reinhard (2002), who did not cite H&D.
    */
    return 1.0 - pow(1.0 + x/HD_Gamma, -HD_Gamma);
}

// Adapted from http://filmicworlds.com/blog/filmic-tonemapping-operators/
float hableCurve(float x) {
    float A = 0.15;
    float B = 0.50;
    float C = 0.10;
    float D = 0.20;
    float E = 0.02;
    float F = 0.30;
    float W = Hable_WhitePoint;

    float mappedWhite = ((W*(A*W+C*B)+D*E)/(W*(A*W+B)+D*F))-E/F;

    // Adjust exposure to set curve derivative at zero to one
    float deriv0 = (B*(C*F-E)/(D*F*F)) / mappedWhite;
    x /= deriv0;

    float mapped = ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
    return min(1.0, mapped / mappedWhite);
}

float logToeStraightShoulder(float x) {
    // todo: reparametrize as ToeCoef, StraightSlope, 
    float logX = log(x);
    float logStartX = log(LTSS_StraightStartX);
    float logEndX = log(LTSS_StraightEndX);

    float straightSlope = (LTSS_StraightEndY - LTSS_StraightStartY) / (logEndX - logStartX);
    if (x < LTSS_StraightStartX) {
        return LTSS_StraightStartY * exp((straightSlope / LTSS_StraightStartY) * (logX - logStartX));
    }
    if (x > LTSS_StraightEndX) {
        return 1.0 - (1.0 - LTSS_StraightEndY) * exp((straightSlope / (1.0 - LTSS_StraightEndY)) * (-logX + logEndX));
    }
    return LTSS_StraightStartY + straightSlope * (logX - logStartX);
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
    if (Curve == 2) return idealFilmCurve(x);
    if (Curve == 3) return hableCurve(x);
    if (Curve == 4) return logToeStraightShoulder(x);
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
        float lum = luminance(x);
        float targetLum = selectedCurve(lum);
        x = x * (targetLum / lum); 
    } else if (Approach == 3) {
        /*
        For some reason, many seem to think of "AgX" as "the specific curve and
        3x3 matrix Troy Sobotka came up with", which is remarkable in light of his
        comments at https://github.com/sobotka/AgX-S2O3.
        "[...] the curve formula employed [...] is detached from the more important mechanisms [...]"
        "[...] no degree of "precision" [in the curve] can afford much utility."
        "Any attempt to harness the ideas within this archive should expose [the] rotation and inset parameters."

        The parameterization here is not quite the same as in the original AgX,
        mostly for performance reasons, but should be similar in spirit.
        */
        const vec3 sum1Gray = vec3(1.0 / 3.0);

        vec3 primaryR = mix(vec3(1.0 - abs(AgX_RotateR), max(0.0, -AgX_RotateR), max(0.0, AgX_RotateR)), sum1Gray, AgX_InsetR);
        vec3 primaryG = mix(vec3(max(0.0, AgX_RotateG), 1.0 - abs(AgX_RotateG), max(0.0, -AgX_RotateG)), sum1Gray, AgX_InsetG);
        vec3 primaryB = mix(vec3(max(0.0, -AgX_RotateB), max(0.0, AgX_RotateB), 1.0 - abs(AgX_RotateB)), sum1Gray, AgX_InsetB);

        mat3 agxMatrix = transpose(mat3(primaryR, primaryG, primaryB));
        mat3 agxMatrixInverse = inverse(agxMatrix);

        x = agxMatrix * x;
        x = APPLY(x, selectedCurve);
        x = agxMatrixInverse * x;
    } else if (Approach == 4) {
        const vec3 white = vec3(1.0, 1.0, 1.0);

        float lum = luminance(x);
        float targetLum = selectedCurve(lum);

        // Scale input to within the output cube
        float maxVal = max(x.r, max(x.g, x.b));
        float scale;
        if (Helium_SmoothScale) {
            scale = selectedCurve(maxVal) / maxVal;
        } else {
            scale = min(targetLum / lum, min(1.0, maxVal) / maxVal);
        }
        vec3 scaled = scale * x;

        // Calculate target luminance not accounted for by scaled input
        float scaledLum = scale * lum;
        float missingLum = targetLum - scaledLum;
        vec3 toWhite = white - scaled;
        float toWhiteLum = 1.0 - scaledLum;

        if (Helium_AbneyComp) {
            // ad hoc Abney effect compensation
            vec3 abneyComp = vec3(
                0.0,
                0.35 * scaled.r * (1.0 - 0.7 * targetLum) * pow(1.0 - scaled.b, 4.0)
                + 0.85 * scaled.b * pow((1.0 - 0.3 * targetLum), 3.0) * pow(1.0 - scaled.r, 5.0),
                0.0
            );
            scaled = scaled + abneyComp * (missingLum / toWhiteLum) * toWhite;
            // Recalculate luminance unaccounted for
            scaledLum = luminance(scaled);
            missingLum = targetLum - scaledLum;
            toWhite = white - scaled;
            toWhiteLum = 1.0 - scaledLum;
        }

        // Move towards white for missing luminance
        x = scaled + (missingLum / toWhiteLum) * toWhite;
    }

    if (ShowExtraClamp) {
        if (min(x.r, min(x.g, x.b)) < -0.001 || max(x.r, max(x.g, x.b)) > 1.001) return vec3(1.0, 0.0, 1.0);
    }

    return x;
}
`,
    "Khronos PBR Neutral":
`
// Includes code from the Khronos PBR Neutral sample GLSL implementation:
// https://github.com/KhronosGroup/ToneMapping/blob/b5a2eed5ddf6c2227090449399de9c7affb9e4c9/PBR_Neutral/pbrNeutral.glsl
// Licensed under the Apache License, Version 2.0:
// https://github.com/KhronosGroup/ToneMapping/blob/main/LICENSE.md

// Begin pbrNeutral.glsl

// Input color is non-negative and resides in the Linear Rec. 709 color space.
// Output color is also Linear Rec. 709, but in the [0, 1] range.

vec3 PBRNeutralToneMapping( vec3 color ) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;

  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;

  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;

  const float d = 1. - startCompression;
  float newPeak = 1. - d * d / (peak + d - startCompression);
  color *= newPeak / peak;

  float g = 1. - 1. / (desaturation * (peak - newPeak) + 1.);
  return mix(color, newPeak * vec3(1, 1, 1), g);
}

// End pbrNeutral.glsl

vec3 tonemap(vec3 x) {
    return PBRNeutralToneMapping(x);
}
`
};

for (const [key, value] of Object.entries(shaders)) {
    shaders[key] = value.trimStart();
}

export default shaders;
