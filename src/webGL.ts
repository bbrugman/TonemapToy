import type { ControllableUniformType, ControllableUniformValue, UniformSpec } from './uniformSpec';
import { parseUserUniforms } from './userControlDSL';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'

const vertexShaderText = `
#version 300 es
layout(location = 0) in vec2 _pos;
out vec2 _uv;

void main() {
    _uv = _pos;
    gl_Position = vec4(2.0 * (_pos - 0.5), 0.0, 1.0);
}
`.trimStart()

const fragmentShaderHeader = `
#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 _uv;
out vec4 _outputColor;
uniform sampler2D _tex;
`.trimStart();

const fragmentShaderFooter = `
vec3 _preTonemap() {
    vec3 rgb = texture(_tex, _uv).rgb;
    
    // DCI-P3
    if (_colorSpace == 1) rgb *= mat3(
        1.14757446756, -0.145068214377, -0.00250625317823,
        -0.0420342808827, 1.04208502869, -5.07478064362e-05,
        -0.0175237672212, -0.0696567845239, 1.08718055175
    );
    // Rec.2020
    if (_colorSpace == 2) rgb *= mat3(
        1.66049100211, -0.587641138789, -0.0728498633199,
        -0.124550474522, 1.13289989713, -0.00834942260437,
        -0.0181507633549, -0.100578898008, 1.11872966136
    );
    // AP1
    if (_colorSpace == 3) rgb *= mat3(
        1.70507964361, -0.624233461473, -0.0808461821347,
        -0.129700530117, 1.13846854657, -0.0087680164525,
        -0.0241663449425, -0.124614158053, 1.148780503
    );
    // AP0
    if (_colorSpace == 4) rgb *= mat3(
        2.52193472982, -1.13702389648, -0.384910833587,
        -0.275479427892, 1.36982897864, -0.0943495506831,
        -0.0159828699974, -0.147789234132, 1.16377210418
    );
    // E-Gamut
    if (_colorSpace == 5) rgb *= mat3(
        1.9072483039, -0.69296653571, -0.214281768188,
        -0.162497920102, 1.37665532527, -0.214157405163,
        -0.127593031637, -0.235238518095, 1.36283154973
    );
    // E-Gamut 2
    if (_colorSpace == 6) rgb *= mat3(
        2.02595499192, -0.805797619853, -0.220154018944,
        -0.202966411128, 1.42299400685, -0.220028625316,
        -0.146439898603, -0.253749154107, 1.40018937584
    );
    
    if (_clampNegative) rgb = max(rgb, 0.);

    return rgb;
}

vec3 _ieotf(vec3 rgb) {
    if (_eotf == 2) return rgb;

    // See https://community.acescentral.com/t/srgb-piece-wise-eotf-vs-pure-gamma/4024
    if (_eotf == 1) return mix(
        1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055,
        12.92 * rgb,
        vec3(lessThan(rgb, vec3(0.0031308)))
    );
    return pow(rgb, vec3(1.0 / 2.2));
}

void main() {
    vec3 tonemapped = tonemap(pow(2., _stops) * _preTonemap());

    if (_showClamp) {
        if (
            min(tonemapped.r, min(tonemapped.g, tonemapped.b)) < -0.0001
            || max(tonemapped.r, max(tonemapped.g, tonemapped.b)) > 1.0001
        ) tonemapped = vec3(1.0, 0.0, 1.0);
    }
    _outputColor = vec4(_ieotf(clamp(tonemapped, 0.0, 1.0)), 1.0);
}
`.trimStart();

export const imageInputUniforms: UniformSpec[] = [
    {
        name: "_colorSpace",
        type: "int",
        control: "select",
        defaultValue: 0,
        options: [
            "None (assume Rec.709 or convert in shader)",
            "DCI-P3 -> Rec.709 D65 (CAT02)",
            "Rec.2020 -> Rec.709",
            "ACEScg (AP1 ~D60) -> Rec.709 D65 (CAT02)",
            "ACES2065-1 (AP0 ~D60) -> Rec.709 D65 (CAT02)",
            "Filmlight E-Gamut -> Rec.709",
            "Filmlight E-Gamut 2 -> Rec.709"
        ],
        label: "Color space conversion"
    },
    {
        name: "_clampNegative",
        type: "bool",
        control: "checkbox",
        defaultValue: false,
        label: "Clamp negative image values"
    }
];

export const sharedLookUniforms: UniformSpec[] = [
    {
        name: "_stops",
        type: "float",
        control: "range",
        min: -10,
        max: 15,
        logarithmic: false,
        defaultValue: 0,
        label: "Exposure factor (stops)"
    },
    {
        name: "_eotf",
        type: "int",
        control: "select",
        defaultValue: 0,
        options: [
            "Gamma 2.2 (sRGB reference display)",
            "sRGB Piecewise",
            "None"
        ],
        label: "Inverse display EOTF applied"
    },
    {
        name: "_showClamp",
        type: "bool",
        control: "checkbox",
        defaultValue: false,
        label: "Mark pre-invEOTF clamped regions"
    }
]

let gl: WebGL2RenderingContext;
let vertexShader: WebGLShader;
let program: WebGLProgram | null = null;
let texture: WebGLTexture | null = null;
let programUniformRefs: Map<
    string,
    { type: ControllableUniformType, location: WebGLUniformLocation | null }
> = new Map();

export function initGLState(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('webgl2');
    if (!ctx) return;
    gl = ctx;

    // vertex shader and geometry need only be set up once
    vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderText);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(vertexShader));
    }

    const square = new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, square, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}

/* Compile and if succesful, return parsed user uniform info needed by UI */
export function compile(userGlsl: string): UniformSpec[] | false {
    const userUniforms = parseUserUniforms(userGlsl);

    // shared controllable uniforms
    const sharedUniformDefLines = [];
    for (const uniform of imageInputUniforms.concat(sharedLookUniforms)) {
        sharedUniformDefLines.push("uniform " + uniform.type + " " + uniform.name + ";");
    }

    // add option defines
    const extraDefineLines = [];
    for (const userUniform of userUniforms) {
        if (userUniform.control === "select") {
            for (const [optionIndex, option] of userUniform.options.entries()) {
                const optionSuffix = option.replaceAll(/[^0-9a-zA-Z_]/g, "").toUpperCase();
                const optionConstant = userUniform.name.toUpperCase() + "_" + optionSuffix;
                extraDefineLines.push(`#define ${optionConstant} ${optionIndex}`);
            }
        }
    }

    const combinedHeader = [
        fragmentShaderHeader,
        sharedUniformDefLines.join("\n"),
        extraDefineLines.join("\n")
    ].join("\n");
    const fragmentShaderSource = [
        combinedHeader,
        userGlsl,
        fragmentShaderFooter
    ].join("\n");


    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        alert("Fragment shader failed to compile:\n" + gl.getShaderInfoLog(fragmentShader));
        gl.deleteShader(fragmentShader);
        return false;
    }

    const newProgram = gl.createProgram()
    gl.attachShader(newProgram, vertexShader);
    gl.attachShader(newProgram, fragmentShader);
    gl.linkProgram(newProgram);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
        alert("Shader program failed to link:\n" + gl.getProgramInfoLog(newProgram));
        gl.deleteProgram(newProgram);
        return false;
    }

    gl.useProgram(newProgram);
    gl.deleteProgram(program);
    program = newProgram;

    programUniformRefs.clear()
    for (const uniform of imageInputUniforms.concat(sharedLookUniforms.concat(userUniforms))) {
        programUniformRefs.set(uniform.name, {
            location: gl.getUniformLocation(program, uniform.name),
            type: uniform.type
        });
    }

    return userUniforms;
}

export function setUniforms(values: Record<string, ControllableUniformValue>) {
    for (const [name, value] of Object.entries(values)) {
        const uniformData = programUniformRefs.get(name);
        if (uniformData) {
            const loc = uniformData.location;
            switch (uniformData.type) {
                case 'bool':
                    gl.uniform1i(loc, +value);
                case 'int':
                    gl.uniform1i(loc, value as number);
                    break;
                case 'uint':
                    gl.uniform1ui(loc, value as number);
                    break;
                case 'float':
                    gl.uniform1f(loc, value as number);
                    break;
                case 'vec3':
                    gl.uniform3f(loc, ...(value as [number, number, number]));
                    break;
            }
        }
    }
}

export function updateImageFromEXRBuffer(buffer: ArrayBuffer) {
    if (program === null) return;
    const { data, width, height } = new EXRLoader().parse(buffer);
    if (data === undefined || width === undefined || height === undefined) return;
    gl.deleteTexture(texture);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // TODO: take into account texData.type?
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.canvas.width = width;
    gl.canvas.height = height;
    gl.viewport(0, 0, width, height);
}

export function draw() {
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
