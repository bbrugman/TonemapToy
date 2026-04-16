import * as CS from '../controlSpec.js';

export default {
    "[Any EXR Image]": {
        uniforms: [
            {
                name: "_colorSpace",
                type: "int",
                controlSpec: {
                    label: "Color space conversion",
                    type: CS.ControlType.SELECT,
                    options: [
                        "None (assume Rec.709 or convert in shader)",
                        "DCI-P3 -> Rec.709 D65 (CAT02)",
                        "Rec.2020 -> Rec.709",
                        "ACEScg (AP1 ~D60) -> Rec.709 D65 (CAT02)",
                        "ACES2065-1 (AP0 ~D60) -> Rec.709 D65 (CAT02)",
                        "Filmlight E-Gamut -> Rec.709",
                        "Filmlight E-Gamut 2 -> Rec.709"
                    ],
                    value: 0
                }
            },
            {
                name: "_clampNegative",
                type: "bool",
                controlSpec: {
                    label: "Prevent negative tonemap inputs",
                    type: CS.ControlType.CHECKBOX,
                    value: true
                }
            }
        ],
        shaderFragment: `
vec3 _preTonemap() {
    vec3 x = texture(_tex, _uv).rgb;
    
    // DCI-P3
    if (_colorSpace == 1) x *= mat3(
        1.14757446756, -0.145068214377, -0.00250625317823,
        -0.0420342808827, 1.04208502869, -5.07478064362e-05,
        -0.0175237672212, -0.0696567845239, 1.08718055175
    );
    // Rec.2020
    if (_colorSpace == 2) x *= mat3(
        1.66049100211, -0.587641138789, -0.0728498633199,
        -0.124550474522, 1.13289989713, -0.00834942260437,
        -0.0181507633549, -0.100578898008, 1.11872966136
    );
    // AP1
    if (_colorSpace == 3) x *= mat3(
        1.70507964361, -0.624233461473, -0.0808461821347,
        -0.129700530117, 1.13846854657, -0.0087680164525,
        -0.0241663449425, -0.124614158053, 1.148780503
    );
    // AP0
    if (_colorSpace == 4) x *= mat3(
        2.52193472982, -1.13702389648, -0.384910833587,
        -0.275479427892, 1.36982897864, -0.0943495506831,
        -0.0159828699974, -0.147789234132, 1.16377210418
    );
    // E-Gamut
    if (_colorSpace == 5) x *= mat3(
        1.9072483039, -0.69296653571, -0.214281768188,
        -0.162497920102, 1.37665532527, -0.214157405163,
        -0.127593031637, -0.235238518095, 1.36283154973
    );
    // E-Gamut 2
    if (_colorSpace == 6) x *= mat3(
        2.02595499192, -0.805797619853, -0.220154018944,
        -0.202966411128, 1.42299400685, -0.220028625316,
        -0.146439898603, -0.253749154107, 1.40018937584
    );
    
    if (_clampNegative) x = max(x, 0.);

    return x;
}
        `.trim()
    },
    "Flat Sponza": {
        imageUrl: new URL("Sponza.exr", import.meta.url),
        uniforms: [
            {
                name: "_skyColor",
                type: "vec3",
                controlSpec: {
                    label: "Sky Color",
                    type: CS.ControlType.COLOR,
                    value: "#3681e2"
                }
            },
            {
                name: "_sunColor",
                type: "vec3",
                controlSpec: {
                    label: "Sun Color",
                    type: CS.ControlType.COLOR,
                    value: "#fff7cb"
                }
            },
            {
                name: "_sunPower",
                type: "float",
                controlSpec: {
                    label: "Sun Power",
                    type: CS.ControlType.RANGE,
                    min: -5.0,
                    max: 10.0,
                    value: 0.0
                }
            },
            {
                name: "_lightColor",
                type: "vec3",
                controlSpec: {
                    label: "Light Color",
                    type: CS.ControlType.COLOR,
                    value: "#ff0000"
                }
            },
            {
                name: "_lightPower",
                type: "float",
                controlSpec: {
                    label: "Light Power",
                    type: CS.ControlType.RANGE,
                    min: -5.0,
                    max: 10.0,
                    value: 0.0
                }
            },
        ],
        shaderFragment: `
vec3 _preTonemap() {
    vec3 x = texture(_tex, _uv).rgb;
    return mat3(
        _lightColor * exp2(_lightPower),
        _sunColor * exp2(_sunPower),
        _skyColor
    ) * x;
}
`.trim()
    },

    "Text Light": {
        imageUrl: new URL("Text.exr", import.meta.url),
        uniforms: [
            {
                name: "_color",
                type: "vec3",
                controlSpec: {
                    label: "Light Color",
                    type: CS.ControlType.COLOR,
                    value: "#0033ff"
                }
            }
        ],
        shaderFragment: `
vec3 _preTonemap() {
    vec3 x = texture(_tex, _uv).rgb;
    return x * _color;
}
`.trim()
    },

    "Checker": {
        imageUrl: new URL("Checker.exr", import.meta.url),
        uniforms: [
            {
                name: "_hue",
                type: "float",
                controlSpec: {
                    label: "Saturated Hue",
                    type: CS.ControlType.RANGE,
                    min: 0,
                    max: 360,
                    value: 0
                }
            },
             {
                name: "_saturation",
                type: "float",
                controlSpec: {
                    label: "Saturation",
                    type: CS.ControlType.RANGE,
                    min: 0,
                    max: 1,
                    value: 1
                }
            }
        ],
        shaderFragment: `
vec3 _hueColor(float hue) {
    float x = hue / 60.;
    float r = abs(x - 3.) - 1.;
    float g = 2. - abs(x - 2.);
    float b = 2. - abs(x - 4.);
    return min(max(vec3(r, g, b), 0.0), 1.0);
}

vec3 _preTonemap() {
    vec3 x = texture(_tex, _uv).rgb;
    float satPart = x.r - x.g;
    float desatPart = x.g;
    vec3 satColor = _hueColor(_hue);
    satColor = mix(
        vec3(dot(satColor, vec3(0.2126, 0.7125, 0.0722))),
        satColor,
        _saturation
    );
    return vec3(desatPart) + satPart * satColor;
}
`.trim()
    },

    "Two Colors": {
                imageUrl: new URL("TwoColors.exr", import.meta.url),
        uniforms: [
            {
                name: "_col1",
                type: "vec3",
                controlSpec: {
                    label: "Color 1",
                    type: CS.ControlType.COLOR,
                    value: "#0080ff"
                }
            },
            {
                name: "_col2",
                type: "vec3",
                controlSpec: {
                    label: "Color 2",
                    type: CS.ControlType.COLOR,
                    value: "#ff8000"
                }
            },
        ],
        shaderFragment: `
vec3 _preTonemap() {
    vec3 x = texture(_tex, _uv).rgb;
    return mat3(
        _col1,
        _col2,
        vec3(0.0)
    ) * x;
}
`.trim()
    },

    "Shelf": {
        imageUrl: new URL("Shelf.exr", import.meta.url),
        uniforms: [
            {
                name: "_rotateMix",
                type: "float",
                controlSpec: {
                    label: "Rotated Hue Mix",
                    type: CS.ControlType.RANGE,
                    value: 0.0,
                    min: 0.0,
                    max: 1.0
                }
            }
        ],
        shaderFragment: `
vec3 _preTonemap() {
    vec3 x = texture(_tex, _uv).rgb;
    return mix(x, x.brg, _rotateMix);
}
`.trim()
    },

};
