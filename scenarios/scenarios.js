import * as CS from '../controlSpec.js';

export default {
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
#define _DYNAMIC_IMAGE 1

vec3 _dynamic_image() {
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
#define _DYNAMIC_IMAGE 1

vec3 _dynamic_image() {
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
#define _DYNAMIC_IMAGE 1

vec3 _hueColor(float hue) {
    float x = hue / 60.;
    float r = abs(x - 3.) - 1.;
    float g = 2. - abs(x - 2.);
    float b = 2. - abs(x - 4.);
    return min(max(vec3(r, g, b), 0.0), 1.0);
}

vec3 _dynamic_image() {
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
#define _DYNAMIC_IMAGE 1

vec3 _dynamic_image() {
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
#define _DYNAMIC_IMAGE 1

vec3 _dynamic_image() {
    vec3 x = texture(_tex, _uv).rgb;
    return mix(x, x.brg, _rotateMix);
}
`.trim()
    },

};
