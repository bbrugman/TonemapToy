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
uniform float UE_BlueCorrection; // range default=0.6 min=0.0 max=1.0
uniform bool ACES_RRT_GlowModule; // default=1
uniform bool ACES_RRT_RedModule; // default=1
uniform bool ACES_RRT_Desaturate; // default=1
uniform bool ACES_ODT_SurroundComp_Desaturate; // default=1
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

vec3 tonemap(vec3 rgb) {

    // Convert to AP1 (ACEScg primaries)
    rgb = rgb * sRGB_to_AP1;

    // UE gamut expansion
    float luma = dot(rgb, AP1_RGB2Y);
    float lumaCoef = 4.0 * luma * luma * UE_ExpandGamut;
    vec3 chroma = rgb / luma;
    float chromaCoef = 4.0 * dot(chroma - 1.0, chroma - 1.0);
    float expandMixCoef = (1.0 - pow(2.0, -lumaCoef)) * (1.0 - pow(2.0, -4.0 * chromaCoef));
    rgb = mix(rgb, rgb * AP1_Expander, expandMixCoef);

    // Basically the ACES 1.3 "Blue Light Artifact Fix" LMT
    rgb = mix(rgb, rgb * AP1_BlueCorrector, UE_BlueCorrection);

    // Convert to AP0 for ACES RRT
    rgb = rgb * AP1_to_AP0;

    float saturation = rgb_2_saturation(rgb);

    if (ACES_RRT_GlowModule) {
        float ycIn = rgb_2_yc(rgb);
        float s = sigmoid_shaper((saturation - 0.4) / 0.2);
        float addedGlow = 1. + glow_fwd(ycIn, RRT_GLOW_GAIN * s, RRT_GLOW_MID);
        rgb *= addedGlow;
    }

    if (ACES_RRT_RedModule) {
        float hue = rgb_2_hue(rgb);
        float centeredHue = center_hue(hue, RRT_RED_HUE);
        // Unreal Engine avoids using the ACES "cubic shaper" for calculating the hue weight,
        // presumably for performance reasons.
        float hueWeight = smoothstep(0.0, 1.0, 1.0 - abs(2. * centeredHue / RRT_RED_WIDTH));
        hueWeight *= hueWeight;
        rgb.r = rgb.r + hueWeight * saturation * (RRT_RED_PIVOT - rgb.r) * (1. - RRT_RED_SCALE);
    }

    // Convert back to AP1
    rgb = rgb * AP0_to_AP1;
    rgb = max(rgb, 0.0);

    if (ACES_RRT_Desaturate) {
        rgb = mix(vec3(dot(rgb, AP1_RGB2Y)), rgb, 0.96);
    }

    // UE film curve
    rgb = vec3(UE_FilmCurve(rgb.r), UE_FilmCurve(rgb.g), UE_FilmCurve(rgb.b));

    // Unreal Engine applies this desaturation despite not applying
    // the "dark to dim surround" gamma adjustment in the ACES 1.2
    // sRGB Output Transform that justifies it there.
    if (ACES_ODT_SurroundComp_Desaturate) {
        rgb = mix(vec3(dot(rgb, AP1_RGB2Y)), rgb, 0.93);
    }

    rgb = max(rgb, 0.0);

    // Unreal Engine deviates from the intended application of ACES LMTs
    // by applying the LMT inverse at a later point.
    rgb = mix(rgb, rgb * AP1_BlueCorrectorInv, UE_BlueCorrection);
    
    return rgb * AP1_to_sRGB;
}
