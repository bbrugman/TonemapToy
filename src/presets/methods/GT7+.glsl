/* 
    Based on
    https://blog.selfshadow.com/publications/s2025-shading-course/pdi/s2025_pbs_pdi_slides_v1.1.pdf
    and the example implementation at
    https://blog.selfshadow.com/publications/s2025-shading-course/pdi/supplemental/gt7_tone_mapping.cpp
*/

const float PEAK_NITS = 250.;
const float PQ_M1 = 2610. / 16384.;
const float PQ_M2 = 2523. / 32.;
const float PQ_C1 = 3424. / 4096.;
const float PQ_C2 = 2413. / 128.;
const float PQ_C3 = 2392. / 128.;

vec3 pqToNits(vec3 pq) {
    vec3 temp = pow(pq, vec3(1. / PQ_M2));
    return pow((temp - PQ_C1) / (PQ_C2 - PQ_C3 * temp), vec3(1. / PQ_M1));
}

vec3 nitsToPQ(vec3 rgb) {
    vec3 temp = pow(rgb, vec3(PQ_M1));
    return pow((PQ_C1 + PQ_C2 * temp) / (1. + PQ_C3 * temp), vec3(PQ_M2));
}

const mat3 Rec2020_to_LMS = mat3(
    1688., 2146., 262.,
    683., 2951., 462.,
    99., 309., 3688.
) / 4096.;

const mat3 LMS_to_Rec2020 = inverse(Rec2020_to_LMS);

const mat3 PQLMS_to_ICtCp = mat3(
    2048., 2048, 0.,
    6610., -13613., 7003.,
    17933., -17390., -543.
) / 4096.;

const mat3 ICtCp_to_PQLMS = inverse(PQLMS_to_ICtCp);

vec3 rec2020ToICtCp(vec3 rgb) {
    return nitsToPQ(rgb * Rec2020_to_LMS) * PQLMS_to_ICtCp;
}

vec3 iCtCpToRec2020(vec3 ucs) {
    return pqToNits(ucs * ICtCp_to_PQLMS) * LMS_to_Rec2020;
}

const mat3 Rec709_to_Rec2020 = mat3(
    0.6274039, 0.32928304, 0.04331307,
    0.06909729, 0.9195404, 0.01136232,
    0.01639144, 0.08801331, 0.89559525
);

const mat3 Rec2020_to_Rec709 = inverse(Rec709_to_Rec2020);

uniform float BlendRatio; // range default=0.6 min=0.0 max=1.0
uniform float ChromaFadeStart; // range default=0.98 min=0.0 max=2.0
uniform float ChromaFadeEnd; // range default=1.16 min=0.0 max=2.0
uniform bool ChromaFix; // default=no

vec3 tonemap(vec3 rgb) {
    rgb = rgb * Rec709_to_Rec2020;
    
    vec3 ucs = rec2020ToICtCp(rgb * PEAK_NITS);
    vec3 perChannel = vec3(toneCurve(rgb.r), toneCurve(rgb.g), toneCurve(rgb.b));
    vec3 perChannelUCS = rec2020ToICtCp(perChannel * PEAK_NITS);
    
    float chromaScale;
    if (!ChromaFix) {
        // Original method
        float par = ucs.x / rec2020ToICtCp(vec3(1.0 * PEAK_NITS)).x;
        chromaScale = 1.0 - smoothstep(ChromaFadeStart, ChromaFadeEnd, par);
    } else {
        // Take "lightness" and "chroma" from the per-channel transform,
        // "hue" from the original
        chromaScale = length(perChannelUCS.yz) / length(ucs.yz);
    }
    vec3 scaledUCS = vec3(
        perChannelUCS.x,
        ucs.yz * chromaScale
    );
    vec3 scaled = max(iCtCpToRec2020(scaledUCS) / PEAK_NITS, 0.);
    
    rgb = mix(perChannel, scaled, BlendRatio);
    /*
        The example implementation from Polyphony Digital implies that the
        above vec3 is "ready for sRGB EOTF".
        That's hard to believe: we haven't converted to Rec. 709 primaries yet!
        Here I infer from the presentation saying "if exposure is set properly,
        color clipping is not an issue" and the lack of any additional 
        discussion on this point that the below is intended.

        It's unclear if values are also clamped to [0,1] before Rec. 709
        conversion in the actual game.
    */
    return rgb * Rec2020_to_Rec709;
}
