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
For each choice, a macro will be created with the
corresponding value as the token. The identifier is the result of
taking the uniform name and choice name, stripping illegal 
characters, uppercasing both, and concatenating with an underscore.
(E.g. UNIFORMNAME_CHOICE1 = 0, UNIFORMNAME_CHOICE2 = 1, ...)

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

uniform float Contrast; // logrange min=0.1 max=10.0 default=1.0
uniform int Approach; // choices Per-channel Value Luminance AgX Helium
uniform int Curve; // choices Clamp Exponential Reinhard Hable Film1890 DoubleGamma
uniform float WhiteClip; // logrange min=1.0 max=10000.0 default=32.0
uniform float Hable_A; // logrange min=0.01 max=2.0 default=0.15
uniform float Hable_B; // logrange min=0.01 max=2.0 default=0.50
uniform float Hable_C; // logrange min=0.01 max=2.0 default=0.10
uniform float Hable_D; // logrange min=0.01 max=2.0 default=0.20
uniform float Hable_E; // logrange min=0.001 max=2.0 default=0.02
uniform float Hable_F; // logrange min=0.01 max=2.0 default=0.30
uniform float Film1890_Gamma; // logrange min=0.1 max=10.0 default=0.65
uniform int Film1890_Mode; // choices Linear_Scan_Invert sRGB_Scan_Invert Film_Print Negative
uniform float Film1890_ScanPostGamma; // logrange min=0.1 max=10.0 default=1.0
uniform float Film1890_PrintGamma; // logrange min=0.1 max=10.0 default=3.5
uniform float Film1890_BoostStops; // range min=0.0 max=20.0 default=5.0
uniform bool Film1890_PrintNormalize; // default=0
uniform float DoubleGamma_High; // logrange min=0.1 max=10.0 default=0.65
uniform float DoubleGamma_Low; // logrange min=0.1 max=10.0 default=2.5
uniform float AgX_RotateR; // range min=-0.5 max=0.5 default=0.04
uniform float AgX_InsetR; // range min=0.0 max=1.0 default=0.15
uniform float AgX_RotateG; // range min=-0.5 max=0.5 default=-0.04
uniform float AgX_InsetG; // range min=0.0 max=1.0 default=0.15
uniform float AgX_RotateB; // range min=-0.5 max=0.5 default=-0.08
uniform float AgX_InsetB; // range min=0.0 max=1.0 default=0.10
uniform int Helium_Scaler; // choices Smooth Direct Value
uniform float Helium_Smoothness; // logrange min=0.1 max=2.0 default=0.2
uniform bool Helium_AbneyComp; // default=1

#define saturate(x) clamp(x, 0.0, 1.0)
#define APPLY(x, c) vec3(c(x.r), c(x.g), c(x.b))

float clampCurve(float x) {
    return min(x, 1.0);
}

float exponentialCurve(float x) {
    return 1.0 - exp(-x);
}

float reinhardCurve(float x) {
    return x / (1.0 + x);
}

// Adapted from http://filmicworlds.com/blog/filmic-tonemapping-operators/
float hableCurve(float x) {
    float A = Hable_A;
    float B = Hable_B;
    float C = Hable_C;
    float D = Hable_D;
    float E = Hable_E;
    float F = Hable_F;
    
    x *= 2.0;
    return min(1.0, ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F);
}

float film1890Curve(float x) {
    // TODO: write something explaining what's going on here.
    // Simulate idealized (monochromatic) film according to 
    // equations from Hurter & Driffield (1890) that few people
    // seem to know about.

    if (
        Film1890_Mode == FILM1890_MODE_FILM_PRINT 
        || Film1890_Mode == FILM1890_MODE_NEGATIVE
    ) {
        // Boost negative exposure
        x *= exp2(Film1890_BoostStops);
    }

    float negativeTransparency = pow(1.0 + x / Film1890_Gamma, -Film1890_Gamma);
    if (Film1890_Mode == FILM1890_MODE_NEGATIVE) return negativeTransparency;

    if (Film1890_Mode == FILM1890_MODE_LINEAR_SCAN_INVERT) {
        // Digitally scan and invert negative in linear RGB
        float scannedValue = 1.0 - negativeTransparency;
        return pow(scannedValue, Film1890_ScanPostGamma);
    }
    if (Film1890_Mode == FILM1890_MODE_SRGB_SCAN_INVERT) {
        // Digitally scan and invert negative in (approximate) sRGB
        float scannedValue = 1.0 - pow(negativeTransparency, 1.0/2.2);
        return pow(scannedValue, 2.2 * Film1890_ScanPostGamma);
    }

    // Simulate analog film printing

    // Solve for print exposure to map boosted 0.18 to 0.18
    float printExposure = (pow(0.18, 1.0 / -Film1890_PrintGamma) - 1.0)
        * Film1890_PrintGamma
        / pow(1.0 + 0.18 * exp2(Film1890_BoostStops) / Film1890_Gamma, -Film1890_Gamma)
    ;

    float printReflectivity = pow(
        1.0 + printExposure * negativeTransparency / Film1890_PrintGamma,
        -Film1890_PrintGamma
    );

    float printFloor = pow(1.0 + printExposure / Film1890_PrintGamma, -Film1890_PrintGamma);    
    if (Film1890_PrintNormalize) {
        return (printReflectivity - printFloor) / (1.0 - printFloor);
    }
    return printReflectivity;
}

float doubleGammaCurve(float x) {
    // Film1890 FilmPrint mode with negative and positive exposure
    // going to infinity in tandem.
    x *= DoubleGamma_Low * DoubleGamma_High;
    return pow(
        1.0 + pow(x, -DoubleGamma_High) / DoubleGamma_Low,
        -DoubleGamma_Low
    );
}

float selectedCurve(float x) {
    x = 0.18 * pow(x / 0.18, Contrast);
    if (Curve == CURVE_CLAMP) return clampCurve(x);
    if (Curve == CURVE_EXPONENTIAL) return min(1.0, exponentialCurve(x) / exponentialCurve(WhiteClip));
    if (Curve == CURVE_REINHARD) return min(1.0, reinhardCurve(x) / reinhardCurve(WhiteClip));
    if (Curve == CURVE_HABLE) return min(1.0, hableCurve(x) / hableCurve(WhiteClip));
    if (Curve == CURVE_FILM1890) return film1890Curve(x);
    if (Curve == CURVE_DOUBLEGAMMA) return doubleGammaCurve(x);
}

float luminance(vec3 linearRGB) {
    // Assuming Rec. 709 primaries
    const vec3 luminanceCoefs = vec3(0.2126, 0.7125, 0.0722);
    return dot(luminanceCoefs, linearRGB);
}

vec3 tonemap(vec3 x) {
    if (Approach == APPROACH_PERCHANNEL) {
        x = APPLY(x, selectedCurve);
    } else if (Approach == APPROACH_VALUE) {
        float maxVal = max(x.r, max(x.g, x.b));
        float target = selectedCurve(maxVal);
        x = x * (target / maxVal);
    } else if (Approach == APPROACH_LUMINANCE) {
        float lum = luminance(x);
        float targetLum = selectedCurve(lum);
        x = x * (targetLum / lum);
    } else if (Approach == APPROACH_AGX) {
        /*
        For some reason, many seem to think of "AgX" as "the specific curve and
        3x3 matrix Troy Sobotka came up with", which is remarkable in light of his
        comments at https://github.com/sobotka/AgX-S2O3.
        "[...] the curve formula employed [...] is detached from the more important
        mechanisms [...]"
        "[...] no degree of "precision" [in the curve] can afford much utility."
        "Any attempt to harness the ideas within this archive should expose [the]
        rotation and inset parameters."

        The parameterization here should be similar in spirit to the original,
        but creates the 3x3 matrix more directly to avoid costly color geometry math.
        */

        vec3 agxPrimaryR = mix(
            vec3(
                1.0 - abs(-AgX_RotateR),
                max(0.0, AgX_RotateR),
                max(0.0, -AgX_RotateR)
            ), vec3(1.0), AgX_InsetR
        );
        vec3 agxPrimaryG = mix(
            vec3(
                max(0.0, -AgX_RotateG),
                1.0 - abs(-AgX_RotateG),
                max(0.0, AgX_RotateG)
            ), vec3(1.0), AgX_InsetG
        );
        vec3 agxPrimaryB = mix(
            vec3(
                max(0.0, AgX_RotateB),
                max(0.0, -AgX_RotateB),
                1.0 - abs(-AgX_RotateB)
            ), vec3(1.0), AgX_InsetB
        );

        mat3 agxMatrix = mat3(agxPrimaryR, agxPrimaryG, agxPrimaryB);
        mat3 agxMatrixInverse = inverse(agxMatrix);
        // Adjust for correct white point
        vec3 wb = agxMatrixInverse * vec3(1.0);
        agxMatrix[0] *= wb.r;
        agxMatrix[1] *= wb.g;
        agxMatrix[2] *= wb.b;
        agxMatrixInverse[0] /= wb;
        agxMatrixInverse[1] /= wb;
        agxMatrixInverse[2] /= wb;

        x = agxMatrix * x;
        x = APPLY(x, selectedCurve);
        x = agxMatrixInverse * x;
    } else if (Approach == APPROACH_HELIUM) {
        // https://github.com/bbrugman/Helium-Tonemapper
        const vec3 white = vec3(1.0, 1.0, 1.0);

        float lum = luminance(x);
        float targetLum = selectedCurve(lum);

        // Scale input to within the output cube
        float maxVal = max(x.r, max(x.g, x.b));
        float scale;
        if (Helium_Scaler == HELIUM_SCALER_VALUE) {
            scale = selectedCurve(maxVal) / maxVal;
        } else {
            scale = targetLum / lum;
            float scaledMax = maxVal * scale;
            if (Helium_Scaler == HELIUM_SCALER_SMOOTH) {
                float p = pow(scaledMax, 1.0 / Helium_Smoothness);
                scaledMax = pow(p / (1.0 + p), Helium_Smoothness);
            } else {
                scaledMax = min(scaledMax, 1.0);    
            }
            scale = scaledMax / maxVal;
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
  
    float chroma = sqrt(max(TINY, b*(b-g) + g*(g-r) + r*(r-b)));
    return (b + g + r + 1.75 * chroma) / 3.;
}

float rgb_2_hue(vec3 rgb) {
    float hue = (180. / 3.14159265) * atan(
        sqrt(3.) * (rgb.g - rgb.b),
        2. * rgb.r - rgb.g - rgb.b
    );
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
        toeIntoStraight = log10(0.18) + 0.5 * (toeHeight / UE_CurveSlope) * log(
            (2. * toeHeight - toeTargetClimb) / toeTargetClimb
        );
    }

    float straightIntoShoulder = (shoulderMin - toeMax) / UE_CurveSlope + toeIntoStraight;

    float logX = log10(x);

    float toe = (2. * toeHeight) / (1. + exp(
        (-2. * UE_CurveSlope / toeHeight) * (logX - toeIntoStraight)
    )) - UE_CurveBlackClip;
    float shoulder = 1.0 - (2. * shoulderHeight) / (1. + exp(
        (2. * UE_CurveSlope / shoulderHeight) * (logX - straightIntoShoulder)
    )) + UE_CurveWhiteClip;
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
    x = mix(vec3(dot(x, AP1_RGB2Y)), x, 0.93);

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
`,
    "GT7":
`
// Based on
// https://blog.selfshadow.com/publications/s2025-shading-course/pdi/s2025_pbs_pdi_slides_v1.1.pdf
// and the example implementation at
// https://blog.selfshadow.com/publications/s2025-shading-course/pdi/supplemental/gt7_tone_mapping.cpp
// gt7_tone_mapping.cpp contains the following license information:

// MIT License
//
// Copyright (c) 2025 Polyphony Digital Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// -----------------------------------------------------------------------------
// Defines the SDR reference white level used in our tone mapping (typically 250 nits).
// -----------------------------------------------------------------------------
#define GRAN_TURISMO_SDR_PAPER_WHITE 250.0 // cd/m^2

// -----------------------------------------------------------------------------
// Gran Turismo luminance-scale conversion helpers.
// In Gran Turismo, 1.0f in the linear frame-buffer space corresponds to
// REFERENCE_LUMINANCE cd/m^2 of physical luminance (typically 100 cd/m^2).
// -----------------------------------------------------------------------------
#define REFERENCE_LUMINANCE 100.0 // cd/m^2 <-> 1.0f

const float peakIntensity = GRAN_TURISMO_SDR_PAPER_WHITE / REFERENCE_LUMINANCE;
uniform float alpha; // range default=0.25 min=0.0 max=1.0
uniform float midPoint; // range default=0.538 min=0.0 max=1.0
uniform float linearSection; // range default=0.444 min=0.0 max=1.0
uniform float toeStrength; // logrange default=1.280 min=0.1 max=10.0

float GT7_Curve(float x)
{

    float k  = (linearSection - 1.0) / (alpha - 1.0);
    float kA = peakIntensity * linearSection + peakIntensity * k;
    float kB = -peakIntensity * k * exp(linearSection / k);
    float kC = -1.0 / (k * peakIntensity);

    if (x < 0.0)
    {
        return 0.0;
    }

    float weightLinear = smoothstep(0.0, midPoint, x);
    float weightToe    = 1.0 - weightLinear;

    // Shoulder mapping for highlights.
    float shoulder = kA + kB * exp(x * kC);

    if (x < linearSection * peakIntensity)
    {
        float toeMapped = midPoint * pow(x / midPoint, toeStrength);
        return weightToe * toeMapped + weightLinear * x;
    }
    else
    {
        return shoulder;
    }
}

// -----------------------------------------------------------------------------
// EOTF / inverse-EOTF for ST-2084 (PQ).
// Note: Introduce exponentScaleFactor to allow scaling of the exponent in the EOTF for Jzazbz.
// -----------------------------------------------------------------------------
float 
eotfSt2084(float n, float exponentScaleFactor)
{

    n = clamp(n, 0.0, 1.0);

    // Base functions from SMPTE ST 2084:2014
    // Converts from normalized PQ (0-1) to absolute luminance in cd/m^2 (linear light)
    // Assumes float input; does not handle integer encoding (Annex)
    // Assumes full-range signal (0-1)
    const float m1  = 0.1593017578125f;                // (2610 / 4096) / 4
    float m2        = 78.84375f * exponentScaleFactor; // (2523 / 4096) * 128
    const float c1  = 0.8359375f;                      // 3424 / 4096
    const float c2  = 18.8515625f;                     // (2413 / 4096) * 32
    const float c3  = 18.6875f;                        // (2392 / 4096) * 32
    const float pqC = 10000.0;                         // Maximum luminance supported by PQ (cd/m^2)

    // Does not handle signal range from 2084 - assumes full range (0-1)
    float np = pow(n, 1.0 / m2);
    float l  = max(0.0, np - c1);

    l = l / (c2 - c3 * np);
    l = pow(l, 1.0 / m1);

    return l * pqC / REFERENCE_LUMINANCE;
}

float
inverseEotfSt2084(float v, float exponentScaleFactor)
{
    const float m1  = 0.1593017578125f;
    float m2        = 78.84375f * exponentScaleFactor;
    const float c1  = 0.8359375f;
    const float c2  = 18.8515625f;
    const float c3  = 18.6875f;
    const float pqC = 10000.0;

    float y = REFERENCE_LUMINANCE * v / pqC; // Normalize for the ST-2084 curve

    float ym = pow(y, m1);
    return exp2(m2 * (log2(c1 + c2 * ym) - log2(1.0 + c3 * ym)));
}

// -----------------------------------------------------------------------------
// ICtCp conversion.
// Reference: ITU-T T.302 (https://www.itu.int/rec/T-REC-T.302/en)
// -----------------------------------------------------------------------------
vec3
rgbToICtCp(vec3 rgb) // Input: linear Rec.2020
{
    float l = (rgb.r * 1688.0 + rgb.g * 2146.0 + rgb.b * 262.0) / 4096.0;
    float m = (rgb.r * 683.0 + rgb.g * 2951.0 + rgb.b * 462.0) / 4096.0;
    float s = (rgb.r * 99.0 + rgb.g * 309.0 + rgb.b * 3688.0) / 4096.0;

    float lPQ = inverseEotfSt2084(l, 1.0);
    float mPQ = inverseEotfSt2084(m, 1.0);
    float sPQ = inverseEotfSt2084(s, 1.0);

    float i = (2048.0 * lPQ + 2048.0 * mPQ) / 4096.0;
    float ct = (6610.0 * lPQ - 13613.0 * mPQ + 7003.0 * sPQ) / 4096.0;
    float cp = (17933.0 * lPQ - 17390.0 * mPQ - 543.0 * sPQ) / 4096.0;
    return vec3(i, ct, cp);
}

vec3
iCtCpToRgb(vec3 ictCp) // Output: linear Rec.2020
{
    float l = ictCp.r + 0.00860904f * ictCp.g + 0.11103f * ictCp.b;
    float m = ictCp.r - 0.00860904f * ictCp.g - 0.11103f * ictCp.b;
    float s = ictCp.r + 0.560031f * ictCp.g - 0.320627f * ictCp.b;

    float lLin = eotfSt2084(l, 1.0);
    float mLin = eotfSt2084(m, 1.0);
    float sLin = eotfSt2084(s, 1.0);

    float r = max(3.43661f * lLin - 2.50645f * mLin + 0.0698454f * sLin, 0.0);
    float g = max(-0.79133f * lLin + 1.9836f * mLin - 0.192271f * sLin, 0.0);
    float b = max(-0.0259499f * lLin - 0.0989137f * mLin + 1.12486f * sLin, 0.0);
    return vec3(r, g, b);
}

// -----------------------------------------------------------------------------
// Jzazbz conversion.
// Reference:
// Muhammad Safdar, Guihua Cui, Youn Jin Kim, and Ming Ronnier Luo,
// "Perceptually uniform color space for image signals including high dynamic
// range and wide gamut," Opt. Express 25, 15131-15151 (2017)
// Note: Coefficients adjusted for linear Rec.2020
// -----------------------------------------------------------------------------
#define JZAZBZ_EXPONENT_SCALE_FACTOR 0.7 // Scale factor for exponent
// BB: Polyphony Digital's example implementation has this at 1.7 by default,
// but that leads to poor results for high exposure values.

vec3
rgbToJzazbz(vec3 rgb) // Input: linear Rec.2020
{
    float l = rgb.r * 0.530004f + rgb.g * 0.355704f + rgb.b * 0.086090f;
    float m = rgb.r * 0.289388f + rgb.g * 0.525395f + rgb.b * 0.157481f;
    float s = rgb.r * 0.091098f + rgb.g * 0.147588f + rgb.b * 0.734234f;

    float lPQ = inverseEotfSt2084(l, JZAZBZ_EXPONENT_SCALE_FACTOR);
    float mPQ = inverseEotfSt2084(m, JZAZBZ_EXPONENT_SCALE_FACTOR);
    float sPQ = inverseEotfSt2084(s, JZAZBZ_EXPONENT_SCALE_FACTOR);

    float iz = 0.5 * lPQ + 0.5 * mPQ;

    float j = (0.44f * iz) / (1.0 - 0.56f * iz) - 1.6295499532821566e-11f;
    float a = 3.524000f * lPQ - 4.066708f * mPQ + 0.542708f * sPQ;
    float b = 0.199076f * lPQ + 1.096799f * mPQ - 1.295875f * sPQ;
    return vec3(j, a, b);
}

vec3
jzazbzToRgb(vec3 jab) // Output: linear Rec.2020
{
    float jz = jab.x + 1.6295499532821566e-11f;
    float iz = jz / (0.44f + 0.56f * jz);
    float a  = jab.y;
    float b  = jab.z;

    float l = iz + a * 1.386050432715393e-1f + b * 5.804731615611869e-2f;
    float m = iz + a * -1.386050432715393e-1f + b * -5.804731615611869e-2f;
    float s = iz + a * -9.601924202631895e-2f + b * -8.118918960560390e-1f;

    float lLin = eotfSt2084(l, JZAZBZ_EXPONENT_SCALE_FACTOR);
    float mLin = eotfSt2084(m, JZAZBZ_EXPONENT_SCALE_FACTOR);
    float sLin = eotfSt2084(s, JZAZBZ_EXPONENT_SCALE_FACTOR);

    float red = lLin * 2.990669f + mLin * -2.049742f + sLin * 0.088977f;
    float green = lLin * -1.634525f + mLin * 3.145627f + sLin * -0.483037f;
    float blue = lLin * -0.042505f + mLin * -0.377983f + sLin * 1.448019f;
    return vec3(red, green, blue);
}

uniform int UCS; // choices ICtCP Jzazbz
uniform float blendRatio; // range default=0.6 min=0.0 max=1.0
uniform float fadeStart; // range default=0.98 min=0.0 max=2.0
uniform float fadeEnd; // range default=1.16 min=0.0 max=2.0

vec3 rgbToUcs(vec3 rgb) {
    if (UCS == UCS_ICTCP) return rgbToICtCp(rgb);
    return rgbToJzazbz(rgb);
}

vec3 ucsToRgb(vec3 ucs) {
    if (UCS == UCS_ICTCP) return iCtCpToRgb(ucs);
    return jzazbzToRgb(ucs);
}

vec3 GT7_Tonemap(vec3 rgb) { // Input: linear Rec.2020
    // Convert to UCS to separate luminance and chroma.
    vec3 ucs = rgbToUcs(rgb);

    // Per-channel tone mapping ("skewed" color).
    vec3 skewedRgb = vec3(
        GT7_Curve(rgb.r),
        GT7_Curve(rgb.g),
        GT7_Curve(rgb.b)
    );

    vec3 skewedUcs = rgbToUcs(skewedRgb);

    vec3 white = vec3(GRAN_TURISMO_SDR_PAPER_WHITE);
    float framebufferLuminanceTargetUcs = rgbToUcs(white).x;
    float chromaScale = 1.0 - smoothstep(
        fadeStart, fadeEnd,
        ucs.x / framebufferLuminanceTargetUcs
    );

    vec3 scaledUcs = vec3(
        skewedUcs.x,         // Luminance from skewed color
        ucs.y * chromaScale, // Scaled chroma components
        ucs.z * chromaScale
    );

    // Convert back to RGB.
    vec3 scaledRgb = ucsToRgb(scaledUcs);
    /*
        BB:
        "scaledRgb" is often *far* out of bounds of the output color space.
        This is not discussed in the presentation and the example
        implementation does not clamp the color before blending.

        The final clamp to display range is doing a lot of work for this
        tonemapper. The resultant points of non-differentiability in the
        paths to white are visible in the chromaticity diagram in the 
        presentation, so this seems to be a genuine fact of the GT7
        tonemapping approach rather than an error or omission in the
        presentation or example implementation.
    */

    // Final blend between per-channel and UCS-scaled results.
    // BB: omitting the display range ceiling here,
    // see comments in tonemap()
    return mix(skewedRgb, scaledRgb, blendRatio) / peakIntensity;
}

const mat3 Rec709_to_Rec2020 = mat3(
    0.6274039, 0.32928304, 0.04331307,
    0.06909729, 0.9195404, 0.01136232,
    0.01639144, 0.08801331, 0.89559525
);

const mat3 Rec2020_to_Rec709 = mat3(
    1.660491, -0.58764114, -0.07284986,
    -0.12455047, 1.1328999, -0.00834942,
    -0.01815076, -0.1005789, 1.11872966
);

vec3 tonemap(vec3 x) {
    x *= peakIntensity; // align exposure with other presets
    vec3 x2020 = x * Rec709_to_Rec2020;
    vec3 tonemapped2020 = GT7_Tonemap(x2020);
    /* 
        BB:
        The example implementation from Polyphony Digital implies that the
        above vec3 is "ready for sRGB EOTF".
        That's hard to believe: we haven't converted to Rec. 709 primaries yet!
        Here we infer from the presentation saying "if exposure is set properly,
        color clipping is not an issue" and the lack of any additional 
        discussion on this point that the below is intended.

        It's unclear if values are clamped to [0,1] before or after Rec. 709
        conversion in the actual game.
    */
    return tonemapped2020 * Rec2020_to_Rec709;
}
`
};

for (const [key, value] of Object.entries(shaders)) {
    shaders[key] = value.trimStart();
}

export default shaders;
