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

uniform float LogContrast; // range min=-3.0 max=3.0 default=0.0
uniform int Curve; // choices Clamp Exponential Hurter_&_Driffield_(1890) Hable LogToeStraightShoulder
uniform int Approach; // choices Per-channel Value Luminance AgX Helium
uniform float HD_Gamma; // logrange min=0.1 max=10.0 default=1.0
uniform float Hable_WhitePoint; // logrange min=1.0 max=100.0 default=11.2
uniform float LTSS_StraightStartX; // logrange min=0.01 max=100.0 default=0.5
uniform float LTSS_StraightEndX; // logrange min=00.1 max=100.0 default=3.0
uniform float LTSS_StraightStartY; // range min=0.0 max=1.0 default=0.3
uniform float LTSS_StraightEndY; // range min=0.0 max=1.0 default=0.8
uniform float AgX_RotateR; // range min=-0.99 max=0.99 default=0.001
uniform float AgX_InsetR; // range min=0.0 max=1.0 default=0.235
uniform float AgX_RotateG; // range min=-0.99 max=0.99 default=-0.042
uniform float AgX_InsetG; // range min=0.0 max=1.0 default=0.127
uniform float AgX_RotateB; // range min=-0.99 max=0.99 default=0.041
uniform float AgX_InsetB; // range min=0.0 max=1.0 default=0.127
uniform bool Helium_SmoothScale; // default=1
uniform bool Helium_AbneyComp; // default=1

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
    return x;
}
`,
    "Unreal":
`
/*
This shader contains GLSL translations of 
Academy Color Encoding System (ACES) code,
the license of which follows.
*/

/*
Academy Color Encoding System (ACES) software and tools are provided by the
Academy under the following terms and conditions: A worldwide, royalty-free,
non-exclusive right to copy, modify, create derivatives, and use, in source and
binary forms, is hereby granted, subject to acceptance of this license.

Copyright © 2015 Academy of Motion Picture Arts and Sciences (A.M.P.A.S.).
Portions contributed by others as indicated. All rights reserved.

Performance of any of the aforementioned acts indicates acceptance to be bound
by the following terms and conditions:

* Copies of source code, in whole or in part, must retain the above copyright
notice, this list of conditions and the Disclaimer of Warranty.

* Use in binary form must retain the above copyright notice, this list of
conditions and the Disclaimer of Warranty in the documentation and/or other
materials provided with the distribution.

* Nothing in this license shall be deemed to grant any rights to trademarks,
copyrights, patents, trade secrets or any other intellectual property of
A.M.P.A.S. or any contributors, except as expressly stated herein.

* Neither the name "A.M.P.A.S." nor the name of any other contributors to this
software may be used to endorse or promote products derivative of or based on
this software without express prior written permission of A.M.P.A.S. or the
contributors, as appropriate.

This license shall be construed pursuant to the laws of the State of
California, and any disputes related thereto shall be subject to the
jurisdiction of the courts therein.

Disclaimer of Warranty: THIS SOFTWARE IS PROVIDED BY A.M.P.A.S. AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT ARE DISCLAIMED. IN NO EVENT SHALL A.M.P.A.S., OR ANY
CONTRIBUTORS OR DISTRIBUTORS, BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, RESITUTIONARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, THE ACADEMY SPECIFICALLY
DISCLAIMS ANY REPRESENTATIONS OR WARRANTIES WHATSOEVER RELATED TO PATENT OR
OTHER INTELLECTUAL PROPERTY RIGHTS IN THE ACADEMY COLOR ENCODING SYSTEM, OR
APPLICATIONS THEREOF, HELD BY PARTIES OTHER THAN A.M.P.A.S.,WHETHER DISCLOSED OR
UNDISCLOSED.
*/

const mat3 sRGB_to_AP1 = mat3(
    0.613164477, 0.339466431, 0.047369092,
    0.070204699, 0.916347730, 0.013447572,
    0.020623075, 0.109585185, 0.869791740
);

const mat3 AP1_to_sRGB = inverse(sRGB_to_AP1);

const mat3 AP1_to_AP0 = mat3(
    0.695452241, 0.140678697, 0.163869062,
    0.044794563, 0.859671119, 0.095534318,
    -0.005525883, 0.004025210, 1.001500672
);

const mat3 AP0_to_AP1 = inverse(AP1_to_AP0);

const mat3 AP1_Expander = AP1_to_sRGB * mat3(
    0.5441691, 0.2395926, 0.1666943,
    0.2394656, 0.7021530, 0.0583814,
    -0.0023439, 0.0361834, 1.0552183
) * mat3(
    1.6410233797, -0.3248032942, -0.2364246952,
    -0.6636628587, 1.6153315917, 0.0167563477,
    0.0117218943, -0.0082844420, 0.9883948585
);

const mat3 AP1_BlueCorrector = AP1_to_AP0 * mat3(
    0.9404372683, -0.0183068787, 0.0778696104,
    0.0083786969,  0.8286599939, 0.1629613092,
    0.0005471261, -0.0008833746, 1.0003362486
) * AP0_to_AP1;

const mat3 AP1_BlueCorrectorInv = inverse(AP1_BlueCorrector);

const vec3 AP1_RGB2Y = vec3(0.2722287168, 0.6740817658, 0.0536895174);

const float RRT_GLOW_GAIN = 0.05;
const float RRT_GLOW_MID = 0.08;
const float RRT_RED_SCALE = 0.82;
const float RRT_RED_PIVOT = 0.03;
const float RRT_RED_HUE = 0.;
const float RRT_RED_WIDTH = 135.;

uniform float UE_ExpandGamut; // range default=1.0 min=0.0 max=1.0
uniform float UE_BlueCorrection; // range default=1.0 min=0.0 max=1.0
uniform bool ACES_RRT_GlowModule; // default=1
uniform bool ACES_RRT_RedModule; // default=1
uniform bool ACES_RRT_Desaturate; // default=1
uniform float UE_CurveSlope; // range default=0.88 min=0.0 max=1.0
uniform float UE_CurveToe; // range default=0.55 min=0.0, max=1.0
uniform float UE_CurveShoulder; // range default=0.26 min=0.0, max=1.0
uniform float UE_CurveBlackClip; // range default=0.0 min=0.0, max=1.0
uniform float UE_CurveWhiteClip; // range default=0.04 min=0.0, max=1.0

float max_f3(vec3 x) {
    return max(max(x.r, x.g), x.b);
}

float min_f3(vec3 x) {
    return min(min(x.r, x.g), x.b);
}

const float TINY = 1e-10;

float rgb_2_saturation(vec3 rgb) {
    return (max(max_f3(rgb), TINY) - max(min_f3(rgb), TINY)) / max(max_f3(rgb), 1e-2);
}

float rgb_2_yc(vec3 rgb) {

    float r = rgb.r; 
    float g = rgb.g; 
    float b = rgb.b;
  
    float chroma = sqrt(max(TINY, b*(b-g)+g*(g-r)+r*(r-b)));
    return ( b + g + r + 1.75 * chroma) / 3.;
}

float rgb_2_hue(vec3 rgb) {
    float hue = (180. / 3.14159265) * atan(sqrt(3.) * (rgb.g - rgb.b), 2. * rgb.r - rgb.g - rgb.b);
    if (hue < 0.) hue = hue + 360.;
    return hue;
}

float sigmoid_shaper(float x) {
    float t = max(1. - abs( x / 2.), 0.);
    float y = 1. + sign(x) * (1. - t * t);

    return y / 2.;
}

float glow_fwd(float ycIn, float glowGainIn, float glowMid) {
    float glowGainOut;

    if (ycIn <= 2./3. * glowMid) {
        glowGainOut = glowGainIn;
    } else if ( ycIn >= 2. * glowMid) {
        glowGainOut = 0.;
    } else {
        glowGainOut = glowGainIn * (glowMid / ycIn - 1./2.);
    }

    return glowGainOut;
}

float center_hue(float hue, float centerH) {
    float hueCentered = hue - centerH;
    if (hueCentered < -180.) hueCentered = hueCentered + 360.;
    else if (hueCentered > 180.) hueCentered = hueCentered - 360.;
    return hueCentered;
}

float log10(float x) {
    return log(x) / log(10.);
}

float UE_FilmCurve(float x) {
    float toeMax = 1.0 - UE_CurveToe;
    float toeHeight = UE_CurveBlackClip + toeMax;
    float shoulderMin = UE_CurveShoulder;
    float shoulderHeight = 1.0 + UE_CurveWhiteClip - UE_CurveShoulder;
    
    float toeIntoStraight;
    if(UE_CurveToe > 0.8) {
        toeIntoStraight = log10(0.18) + (toeMax - 0.18) / UE_CurveSlope;
    } else {
        float toeTargetClimb = UE_CurveBlackClip + 0.18;
        toeIntoStraight = log10(0.18) + 0.5 * (toeHeight / UE_CurveSlope) * log((2. * toeHeight - toeTargetClimb) / toeTargetClimb);
    }

    float straightIntoShoulder = (shoulderMin - toeMax) / UE_CurveSlope + toeIntoStraight;

    float logX = log10(x);

    float toe = (2. * toeHeight) / (1. + exp((-2. * UE_CurveSlope / toeHeight) * (logX - toeIntoStraight))) - UE_CurveBlackClip;
    float shoulder = 1.0 + UE_CurveWhiteClip - (2. * shoulderHeight) / (1. + exp((2. * UE_CurveSlope / shoulderHeight) * (logX - straightIntoShoulder)));
    float straight = toeMax + UE_CurveSlope * (logX - toeIntoStraight);
    
    float toeAndStraight = mix(toe, straight, toe < straight);
    float shoulderAndStraight = mix(shoulder, straight, straight < shoulder);
    
    float mixCoef;
    if (toeIntoStraight < straightIntoShoulder) {
        mixCoef = smoothstep(toeIntoStraight, straightIntoShoulder, logX);
    } else {
        mixCoef = smoothstep(straightIntoShoulder, toeIntoStraight, logX);
    }
    return mix(toeAndStraight, shoulderAndStraight, mixCoef);
}

vec3 tonemap(vec3 x) {

    // Convert to AP1 (ACEScg primaries)
    x = x * sRGB_to_AP1;

    // UE gamut expansion
    float luma = dot(x, AP1_RGB2Y);
    float lumaCoef = 4.0 * luma * luma * UE_ExpandGamut;
    vec3 chroma = x / luma;
    float chromaCoef = 4.0 * dot(chroma - 1.0, chroma - 1.0);
    float expandMixCoef = (1.0 - pow(2.0, -lumaCoef)) * (1.0 - pow(2.0, -4.0 * chromaCoef));
    x = mix(x, x * AP1_Expander, expandMixCoef);

    // Basically the ACES 1.3 "Blue Light Artifact Fix" LMT
    x = mix(x, x * AP1_BlueCorrector, UE_BlueCorrection);

    // Convert to AP0 for ACES RRT
    x = x * AP1_to_AP0;

    float saturation = rgb_2_saturation(x);

    if (ACES_RRT_GlowModule) {
        float ycIn = rgb_2_yc(x);
        float s = sigmoid_shaper((saturation - 0.4) / 0.2);
        float addedGlow = 1. + glow_fwd(ycIn, RRT_GLOW_GAIN * s, RRT_GLOW_MID);
        x *= addedGlow;
    }

    if (ACES_RRT_RedModule) {
        float hue = rgb_2_hue(x);
        float centeredHue = center_hue(hue, RRT_RED_HUE);
        // Unreal Engine avoids using the ACES "cubic shaper" for calculating the hue weight,
        // presumably for performance reasons.
        float hueWeight = smoothstep(0.0, 1.0, 1.0 - abs(2. * centeredHue / RRT_RED_WIDTH));
        hueWeight *= hueWeight;
        x.r = x.r + hueWeight * saturation * (RRT_RED_PIVOT - x.r) * (1. - RRT_RED_SCALE);
    }

    // Convert back to AP1
    x = x * AP0_to_AP1;
    x = max(x, 0.0);

    if (ACES_RRT_Desaturate) {
        x = mix(vec3(dot(x, AP1_RGB2Y)), x, 0.96);
    }

    // UE film curve
    x = vec3(UE_FilmCurve(x.r), UE_FilmCurve(x.g), UE_FilmCurve(x.b));

    // Unreal Engine applies this desaturation despite not applying
    // the "dark to dim surround" gamma adjustment in the ACES 1.2
    // sRGB Output Transform that justifies it there.
    x = mix(vec3(dot(x, AP1_RGB2Y )), x, 0.93);

    x = max(x, 0.0);

    // Unreal Engine deviates from the intended application of ACES LMTs
    // by applying the LMT inverse at a later point.
    x = mix(x, x * AP1_BlueCorrectorInv, UE_BlueCorrection);
    
    return x * AP1_to_sRGB;
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
