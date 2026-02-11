import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import shaderPresets from './shaderPresets.js';
import sampleExrs from './exrs/sampleExrs.js';
import * as uiC from './uiCore.js';
import { vertexShaderText, fragmentShaderHeader, fragmentShaderFooter } from './shaderFragments.js';

const INITIAL_SHADER_PRESET = "Multi";
const INITIAL_IMAGE = "Shelf";

const UniformControlType = {
    CHECKBOX: "CHECKBOX",
    NUMBER: "NUMBER",
    RANGE: "RANGE",
    SELECT: "SELECT"
};

function parseUniformDefs(glsl) {
    const result = [];

    // strip comments
    const glslStripped = glsl.replace(/\/\*.*?\*\//gs, "");

    for (const line of glslStripped.split("\n")) {
        const match = line.match(/^\s*uniform\s*(bool|float|int|uint)\s*(\w*)\s*;\s*(?:\/\/\s*(.*))?/);
        if (match === null) continue;

        const type = match[1];
        const name = match[2];
        const uniformData = {
            name: name,
            type: type,
            control: (type === "bool") ? UniformControlType.CHECKBOX : UniformControlType.NUMBER
        };

        const optionComment = match[3]
        if (optionComment !== undefined) { // we have an option comment to parse
            const options = optionComment.split(/\s+/);

            // assume either a "choices" option, "choices <choice1> <choice2> ..."
            if (options[0] === "choices" && options.length > 1 && (type === "int" || type === "uint")) {
                uniformData.control = UniformControlType.SELECT;
                uniformData.choices = options.slice(1);
            } else { // ...or, options parseable in any order
                for (const option of options) {
                    if ((option === "range" || option === "logrange") && type === "float") {
                        uniformData.control = UniformControlType.RANGE;
                        uniformData.logarithmic = (option === "logrange");
                    }
                    else if (option.startsWith("min=")) {
                        uniformData.min = Number.parseFloat(option.slice("min=".length));
                    }
                    else if (option.startsWith("max=")) {
                        uniformData.max = Number.parseFloat(option.slice("max=".length));
                    }
                    else if (option.startsWith("default=")) {
                        if (uniformData.control === UniformControlType.CHECKBOX) {
                            // ^ If a later option could change the control type, we couldn't get away with this.
                            // Here, we're OK because there's no option that changes the control type for booleans.

                            // checkbox "checked" property is boolean in DOM API
                            uniformData.defaultValue = !option.slice("default=".length).match(/(false|no|0)/i);
                        } else {
                            // Other <input> values are strings.
                            // Maybe we'd want to not couple to DOM API specifics here.
                            // But the alternative in this case is pointless parsing and re-stringifying, so....
                            uniformData.defaultValue = option.slice("default=".length);
                        }
                    }
                }
            }
        }

        result.push(uniformData);
    }
    return result;
}

function initGLState(canvas) {
    const gl = canvas.getContext('webgl2');
    // vertex shader and geometry need only be set up once
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderText);
    gl.compileShader(vertexShader);

    const square = new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, square, gl.STATIC_DRAW);

    return {
        glContext: gl,
        vertexShader: vertexShader,
        fragmentShader: null,
        program: null,
        texture: null,
        imageAspectRatio: 1
    };
}

function updateGLProgram(glState, fragmentShaderSource) {
    let gl = glState.glContext;

    console.log("Updating shader...");
    gl.deleteProgram(glState.program);
    gl.deleteShader(glState.fragmentShader);
    glState.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(glState.fragmentShader, fragmentShaderSource);
    gl.compileShader(glState.fragmentShader);
    if (!gl.getShaderParameter(glState.fragmentShader, gl.COMPILE_STATUS)) {
        alert("Fragment shader (your code starting at line 9) failed to compile:\n"
            + gl.getShaderInfoLog(glState.fragmentShader));
        return;
    }

    glState.program = gl.createProgram()
    gl.attachShader(glState.program, glState.vertexShader);
    gl.attachShader(glState.program, glState.fragmentShader);
    gl.linkProgram(glState.program);
    if (!gl.getProgramParameter(glState.program, gl.LINK_STATUS)) {
        alert("Shader program failed to link:\n" + gl.getProgramInfoLog(glState.program));
        return;
    }

    console.log("Shader program compiled and linked succesfully.");
    const posLoc = gl.getAttribLocation(glState.program, '_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(glState.program);
}

function updateUniformUI(container, uniformData, prevUniformData) {
    container.innerHTML = ""; // clear current controls

    prevUniformData = prevUniformData || {};

    for (const [uniformIndex, uniform] of uniformData.entries()) {

        let prevValue = null;
        if (uniform.name in prevUniformData && uniform.type == prevUniformData[uniform.name].type) {
            // restore this value if possible
            prevValue = prevUniformData[uniform.name].value;
        }

        switch (uniform.control) {
            case UniformControlType.CHECKBOX:
                {
                    let checked = true;
                    if ("defaultValue" in uniform) checked = uniform.defaultValue;
                    if (prevValue !== null) checked = (prevValue === 1);

                    const control = uiC.createLabeledCheckboxControl(uniform.name, checked);
                    container.appendChild(control.element);

                    uniform.getValue = control.getValue;
                }
                break;
            case UniformControlType.NUMBER:
                {
                    let value = "0";
                    if ("defaultValue" in uniform) value = uniform.defaultValue;
                    if (prevValue !== null) value = prevValue;

                    const control = uiC.createNumericControl(value);
                    container.appendChild(uiC.labelControl(uniform.name, control).element);

                    uniform.getValue = control.getValue;
                }
                break;
            case UniformControlType.RANGE:
                {
                    let value = undefined; // rely on control init
                    if ("defaultValue" in uniform) value = uniform.defaultValue;

                    if (prevValue !== null && prevValue >= uniform.min && prevValue <= uniform.max) {
                        value = prevValue;
                    }

                    const control = uiC.createRangeControl(uniform.min, uniform.max, value, uniform.logarithmic);
                    const labeled = uiC.labelControl(uniform.name, control).element;
                    labeled.appendChild(uiC.createLinkedNumericControl(control).element);
                    container.appendChild(labeled);

                    uniform.getValue = control.getValue;
                }
                break;
            case UniformControlType.SELECT:
                {
                    let value = 0;
                    if (prevValue !== null && prevValue < uniform.choices.length) {
                        value = prevValue;
                    }
                    const control = uiC.createSelectorControl(uniform.choices, undefined, value);
                    container.appendChild(uiC.labelControl(uniform.name, control).element);

                    uniform.getValue = control.getValue;
                }
                break;
        }
    }
}

function updateImageFromEXRBuffer(glState, buffer, canvasElement) {
    const gl = glState.glContext;
    gl.deleteTexture(glState.texture);
    const texData = new EXRLoader().parse(buffer);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // TODO: take into account texData.type?
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, texData.width, texData.height, 0, gl.RGBA, gl.HALF_FLOAT, texData.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    glState.texture = texture;
    glState.imageAspectRatio = texData.width / texData.height;
    canvasElement.width = texData.width;
    canvasElement.height = texData.height;
    gl.viewport(0, 0, texData.width, texData.height);
}

function updateImageFromURL(glState, url, canvasElement) {
    const fileLoader = new THREE.FileLoader();
    fileLoader.responseType = "arraybuffer";
    fileLoader.load(url, (data) => {
        updateImageFromEXRBuffer(glState, data, canvasElement);
    });
}

document.addEventListener("DOMContentLoaded", (e) => {
    const canvas = document.getElementsByTagName("canvas")[0];
    const glState = initGLState(canvas);
    console.log(glState);

    let uniformData = null;

    const uniformControls = document.getElementById("uniform-controls");

    function updateShader() {

        // current uniform data to restore for uniforms whose name and type doesn't change
        const prevUniformData = {};
        for (const userUniform of uniformData || []) {
            prevUniformData[userUniform.name] = {
                type: userUniform.type,
                value: userUniform.getValue()
            }
        }

        const userCode = userCodeInput.value;
        uniformData = parseUniformDefs(userCode);
        updateUniformUI(uniformControls, uniformData, prevUniformData);

        // add defines for choice uniforms
        const extraDefineLines = [];
        for (const userUniform of uniformData) {
            if (!("choices" in userUniform)) continue;
            for (const [choiceIndex, choice] of userUniform.choices.entries()) {
                const choiceSuffix = choice.replace(/[^0-9a-zA-Z_]/, "").toUpperCase()
                const choiceConstant = userUniform.name.toUpperCase() + "_" + choiceSuffix;
                extraDefineLines.push(`#define ${choiceConstant} ${choiceIndex}`);
            }
        }
        const extraDefines = extraDefineLines.join("\n");
        updateGLProgram(glState, [
            fragmentShaderHeader,
            extraDefines,
            userCode,
            fragmentShaderFooter
        ].join("\n"));
    }

    // main loop
    function update() {
        const gl = glState.glContext;
        const program = glState.program;
        gl.uniform1f(gl.getUniformLocation(program, "_viewAspectRatio"), canvas.width / canvas.height);
        gl.uniform1f(gl.getUniformLocation(program, "_imageAspectRatio"), glState.imageAspectRatio);
        gl.uniform1i(gl.getUniformLocation(program, "_tex"), 0);
        gl.uniform1f(gl.getUniformLocation(program, "_exposure"), Math.pow(2, exposureControl.getValue()));
        gl.uniform1i(gl.getUniformLocation(program, "_showClamp"), showClampControl.getValue());
        gl.uniform1i(gl.getUniformLocation(program, "_pureGammaEncode"), encodingControl.getValue());

        for (const uniform of uniformData) {
            const uniformLoc = gl.getUniformLocation(program, uniform.name);
            const uniformValue = uniform.getValue();
            switch (uniform.type) {
                case "bool":
                case "int":
                case "uint":
                    gl.uniform1i(uniformLoc, uniformValue);
                    break;
                case "float":
                    gl.uniform1f(uniformLoc, uniformValue);
                    break;
            }
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(update);
    }

    // create static controls
    const staticControls = document.getElementById("static-controls");
    let add = function (labelText, control) {
        const div = uiC.labelControl(labelText, control).element;
        staticControls.appendChild(div);
        return div;
    }

    const imageSelect = uiC.createSelectorControl(Object.keys(sampleExrs), Object.values(sampleExrs), sampleExrs[INITIAL_IMAGE]);
    imageSelect.element.addEventListener("change", (e) => {
        updateImageFromURL(glState, imageSelect.getValue(), canvas);
    });
    add("Sample image", imageSelect);

    const fileInput = document.createElement("input");
    fileInput.setAttribute("type", "file");
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            updateImageFromEXRBuffer(glState, reader.result, canvas);
        };
        reader.readAsArrayBuffer(file);
    });
    staticControls.appendChild(uiC.labelDiv("EXR image file", fileInput));

    const exposureControl = uiC.createRangeControl(-10, 15, 0);
    exposureControl.element.setAttribute("step", 0.1);
    let exposureDiv = add("Exposure", exposureControl);
    exposureDiv.appendChild(uiC.createLinkedNumericControl(exposureControl).element);

    const showClampControl = uiC.createLabeledCheckboxControl("Mark clamped regions");
    staticControls.appendChild(showClampControl.element);

    const encodingControl = uiC.createLabeledCheckboxControl("Encode in gamma 2.2", true);
    staticControls.appendChild(encodingControl.element);

    const presetSelect = uiC.createSelectorControl(Object.keys(shaderPresets), Object.keys(shaderPresets), INITIAL_SHADER_PRESET);
    presetSelect.element.addEventListener("change", (e) => {
        userCodeInput.value = shaderPresets[presetSelect.getValue()];
        updateShader();
    });
    add("Preset shader", presetSelect);

    const userCodeInput = document.createElement("textarea");
    userCodeInput.setAttribute("rows", 15);
    userCodeInput.setAttribute("cols", 72);
    userCodeInput.value = shaderPresets[INITIAL_SHADER_PRESET];
    staticControls.appendChild(uiC.labelDiv("GLSL", userCodeInput));

    const compileButton = uiC.createButton("Compile");
    compileButton.addEventListener("click", updateShader);
    staticControls.appendChild(compileButton);

    // run
    THREE.Cache.enabled = true;
    updateImageFromURL(glState, imageSelect.getValue(), canvas);
    updateShader();
    requestAnimationFrame(update);
});
