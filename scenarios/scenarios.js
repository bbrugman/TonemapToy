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
                    value: "#00a2ff"
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
                    value: "#ff3300"
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

float _tent(float x) {
    return 1. - abs(x);
}

vec3 _dynamic_image() {
    vec3 x = texture(_tex, _uv).rgb;
    return mix(x, x.brg, _rotateMix);
}
`.trim()
    },

};
