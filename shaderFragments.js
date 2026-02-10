export const vertexShaderText = `
#version 300 es
in vec2 _pos;
out vec2 _uv;
uniform float _viewAspectRatio;
uniform float _imageAspectRatio;

void main() {
    _uv = _pos;
    vec2 aspectCorrectPos = 2.0 * vec2(_imageAspectRatio / _viewAspectRatio * (_pos.x-0.5), (_pos.y-0.5));
    gl_Position = vec4(aspectCorrectPos, 0, 1);
}
`.trim()

export const fragmentShaderHeader = `
#version 300 es
precision mediump float;
`.trim();

export const fragmentShaderFooter = `
in vec2 _uv;
out vec4 _outputColor;
uniform sampler2D _tex;
uniform float _exposure;
uniform bool _showClamp;
uniform bool _pureGammaEncode;


vec3 _sRgbIeotf(vec3 x) {
    // See https://community.acescentral.com/t/srgb-piece-wise-eotf-vs-pure-gamma/4024
    if (_pureGammaEncode) {
        return pow(x, vec3(1.0 / 2.2));
    }
    return mix(
        1.055 * pow(x, vec3(1.0 / 2.4)) - 0.055,
        12.92 * x,
        vec3(lessThan(x, vec3(0.0031308)))
    );
}

void main() {
    #ifndef _DYNAMIC_IMAGE
        vec3 x = texture(_tex, _uv).rgb;
        x = max(x, 0.0);
    #else
        vec3 x = _dynamic_image();
        x = max(x, 0.0);
    #endif

    vec3 tonemapped = tonemap(_exposure * x);

    if (_showClamp) {
        if (
            min(tonemapped.r, min(tonemapped.g, tonemapped.b)) < -0.0001
            || max(tonemapped.r, max(tonemapped.g, tonemapped.b)) > 1.0001
        ) tonemapped = vec3(1.0, 0.0, 1.0);
    }
    _outputColor = vec4(_sRgbIeotf(clamp(tonemapped, 0.0, 1.0)), 1.0);
}
`.trim();
