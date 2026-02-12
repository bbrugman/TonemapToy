"use strict";

import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import shaderPresets from './shaderPresets.js';
import * as uiC from './uiCore.js';
import { vertexShaderText, fragmentShaderHeader, fragmentShaderFooter } from './shaderFragments.js';
import * as CS from './controlSpec.js';
import scenarios from './scenarios/scenarios.js';

const INITIAL_SHADER_PRESET = "Multi";
const INITIAL_SCENARIO = "Flat Sponza";

function parseUniformDefs(glsl) {
    const result = [];

    // strip comments
    const glslStripped = glsl.replace(/\/\*.*?\*\//gs, "");

    for (const line of glslStripped.split("\n")) {
        const match = line.match(/^\s*uniform\s*(bool|float|int|uint)\s*(\w*)\s*;\s*(?:\/\/\s*(.*))?/);
        if (match === null) continue;

        const type = match[1];
        const name = match[2];
        const uniformInfo = {
            name: name,
            type: type,
            controlType: (type === "bool") ? CS.ControlType.CHECKBOX : CS.ControlType.NUMBER
        };

        const controlComment = match[3]
        if (controlComment !== undefined) { // we have a control comment to parse
            const args = controlComment.split(/\s+/);

            // assume either "options" arguments, "options <option1> <option2> ..."
            if (args[0] === "options" && args.length > 1 && (type === "int" || type === "uint")) {
                uniformInfo.controlType = CS.ControlType.SELECT;
                uniformInfo.options = args.slice(1);
            } else { // ...or, arguments parseable in any order
                for (const arg of args) {
                    if ((arg === "range" || arg === "logrange") && type === "float") {
                        uniformInfo.controlType = CS.ControlType.RANGE;
                        uniformInfo.logarithmic = (arg === "logrange");
                    }
                    else if (arg.startsWith("min=")) {
                        uniformInfo.min = Number.parseFloat(arg.slice("min=".length));
                    }
                    else if (arg.startsWith("max=")) {
                        uniformInfo.max = Number.parseFloat(arg.slice("max=".length));
                    }
                    else if (arg.startsWith("default=")) {
                        if (uniformInfo.controlType === CS.ControlType.CHECKBOX) {
                            // ^ If a later option could change the control type, we couldn't get away with this.
                            // Here, we're OK because there's no option that changes the control type for booleans.

                            // checkbox "checked" property is boolean in DOM API
                            uniformInfo.defaultValue = !arg.slice("default=".length).match(/(false|no|0)/i);
                        } else {
                            // Other <input> values are strings.
                            // Maybe we'd want to not couple to DOM API specifics here.
                            // But the alternative in this case is pointless parsing and re-stringifying, so....
                            uniformInfo.defaultValue = arg.slice("default=".length);
                        }
                    }
                }
            }
        }

        result.push(uniformInfo);
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

function updateUniformUI(container, uniformData, prevUniformValues) {
    /* Create controls for uniforms, add getValue property to each */
    container.innerHTML = ""; // clear current controls

    prevUniformValues = prevUniformValues || {};

    for (const uniformInfo of uniformData) {
        const controlSpec = {
            type: uniformInfo.controlType,
            label: uniformInfo.name,
            min: uniformInfo.min,
            max: uniformInfo.max,
            logarithmic: uniformInfo.logarithmic,
            options: uniformInfo.options
        }

        if (uniformInfo.name in prevUniformValues && uniformInfo.type == prevUniformValues[uniformInfo.name].type) {
            // restore this value if possible
            controlSpec.value = CS.outToIn(controlSpec.type, prevUniformValues[uniformInfo.name].value);

            if (!CS.isValueValid(controlSpec)) controlSpec.value = uniformInfo.defaultValue;
        } else controlSpec.value = uniformInfo.defaultValue;

        const control = CS.createControl(controlSpec);
        uniformInfo.getValue = control.getValue;
        container.appendChild(control.element);
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

function updateImageFromURL(url, glState, canvasElement) {
    const fileLoader = new THREE.FileLoader();
    fileLoader.responseType = "arraybuffer";
    fileLoader.load(url, (data) => {
        updateImageFromEXRBuffer(glState, data, canvasElement);
    });
}

document.addEventListener("DOMContentLoaded", (e) => {
    const canvas = document.getElementsByTagName("canvas")[0];
    const glState = initGLState(canvas);

    let uniformData = null;
    let scenario = null;

    const uniformControls = document.getElementById("uniform-controls");
    const staticControls = document.getElementById("static-controls");
    const shaderControls = document.getElementById("shader-controls");
    const scenarioControls = document.getElementById("scenario-controls");

    function updateScenario() {
        updateImageFromURL(scenario.imageUrl, glState, canvas);
        updateShaderAndUI();
    }

    function updateShaderAndUI() {
        // current uniform data to restore for uniforms whose name and type doesn't change
        const prevUniformValues = {};
        for (const uniform of uniformData || []) {
            prevUniformValues[uniform.name] = {
                type: uniform.type,
                value: uniform.getValue()
            }
        }

        const userCode = userCodeInput.value;
        uniformData = parseUniformDefs(userCode);
        updateUniformUI(uniformControls, uniformData, prevUniformValues);

        // add defines for option uniforms
        const extraDefineLines = [];
        for (const userUniform of uniformData) {
            if (!("options" in userUniform)) continue;
            for (const [optionIndex, option] of userUniform.options.entries()) {
                const optionSuffix = option.replace(/[^0-9a-zA-Z_]/, "").toUpperCase()
                const optionConstant = userUniform.name.toUpperCase() + "_" + optionSuffix;
                extraDefineLines.push(`#define ${optionConstant} ${optionIndex}`);
            }
        }
        const extraDefines = extraDefineLines.join("\n");

        let scenarioFragments = [];

        scenarioControls.innerHTML = "";
        if (scenario !== null) {
            for (const scenarioUniform of scenario.uniforms) {
                // add uniform definition
                scenarioFragments.push(`uniform ${scenarioUniform.type} ${scenarioUniform.name};`);
                // create scenario UI
                const controlSpec = Object.assign({}, scenarioUniform.controlSpec);
                if (scenarioUniform.name in prevUniformValues) {
                    console.log(controlSpec);
                    console.log("Controlspec default:", controlSpec.value);
                    const prevValue = prevUniformValues[scenarioUniform.name].value;
                    console.log("Recovered value:", prevValue);
                    controlSpec.value = CS.outToIn(controlSpec.type, prevValue);
                    console.log("Recovered value:", controlSpec.value);
                }
                const control = CS.createControl(controlSpec);
                scenarioControls.appendChild(control.element);
                // add scenario uniforms to uniform data (without control info)
                uniformData.push({
                    name: scenarioUniform.name,
                    type: scenarioUniform.type,
                    getValue: control.getValue
                });
            }
            scenarioFragments.push(scenario.shaderFragment);
        }

        const scenarioFragment = scenarioFragments.join("\n");

        updateGLProgram(glState, [
            fragmentShaderHeader,
            extraDefines,
            userCode,
            scenarioFragment,
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
                case "vec3":
                    gl.uniform3f(uniformLoc, uniformValue[0], uniformValue[1], uniformValue[2]);
                    break;
            }
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(update);
    }

    // create static controls
    let add = function (container, labelText, control) {
        const div = uiC.labelControl(labelText, control).element;
        container.appendChild(div);
        return div;
    }

    const scenarioSelect = uiC.createSelectorControl(Object.keys(scenarios), Object.keys(scenarios), INITIAL_SCENARIO);
    scenarioSelect.element.addEventListener("change", (e) => {
        scenario = scenarios[scenarioSelect.getValue()];
        updateScenario();
    });
    add(staticControls, "Scenario", scenarioSelect);

    const fileInput = document.createElement("input");
    fileInput.setAttribute("type", "file");
    fileInput.addEventListener("change", (e) => {
        if (scenario !== null) {
            scenario = null;
            updateShaderAndUI();
        }

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
    let exposureDiv = add(staticControls, "Exposure", exposureControl);
    exposureDiv.appendChild(uiC.createLinkedNumericControl(exposureControl).element);

    const showClampControl = uiC.createLabeledCheckboxControl("Mark clamped regions");
    staticControls.appendChild(showClampControl.element);

    const encodingControl = uiC.createLabeledCheckboxControl("Encode in gamma 2.2", true);
    staticControls.appendChild(encodingControl.element);

    const presetSelect = uiC.createSelectorControl(Object.keys(shaderPresets), Object.keys(shaderPresets), INITIAL_SHADER_PRESET);
    presetSelect.element.addEventListener("change", (e) => {
        userCodeInput.value = shaderPresets[presetSelect.getValue()];
        updateShaderAndUI();
    });
    add(shaderControls, "Preset shader", presetSelect);

    const userCodeInput = document.createElement("textarea");
    userCodeInput.setAttribute("rows", 15);
    userCodeInput.setAttribute("cols", 72);
    userCodeInput.value = shaderPresets[INITIAL_SHADER_PRESET];
    shaderControls.appendChild(uiC.labelDiv("GLSL", userCodeInput));

    const compileButton = uiC.createButton("Compile");
    compileButton.addEventListener("click", updateShaderAndUI);
    shaderControls.appendChild(compileButton);

    // run
    THREE.Cache.enabled = true;
    scenario = scenarios[INITIAL_SCENARIO];
    updateScenario();
    requestAnimationFrame(update);
});
