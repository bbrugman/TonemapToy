import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import shaderPresets from './shaderPresets.js';

const UniformControlType = {
    CHECKBOX: "CHECKBOX",
    NUMBER: "NUMBER",
    RANGE: "RANGE",
    SELECT: "RADIO"
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

document.addEventListener("DOMContentLoaded", (e) => {
    const fileInput = document.getElementById("file-input");
    const canvas = document.getElementsByTagName("canvas")[0];
    const vsText = document.getElementById("vs").textContent.trim();
    const fsText = document.getElementById("fs").textContent.trim();
    const presetSelect = document.getElementById("preset-select");
    const shaderInput = document.getElementById("user-shader");
    const compileButton = document.getElementById("compile-shader");
    const exposureInput = document.getElementById("exposure-input");
    const uniformControls = document.getElementById("uniform-controls");

    const gl = canvas.getContext('webgl2');

    // vertex shader and geometry need only be set up once
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vsText);
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

    // state
    let program = null;
    let fragmentShader = null;
    let texture = null;
    let userUniforms = null;
    let imageAspectRatio = 1;

    function updateShader() {
        console.log("Updating shader...");
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);

        // current uniform data to restore for uniforms whose name and type doesn't change
        const prevUniformData = {};
        for (const userUniform of userUniforms || []) {
            prevUniformData[userUniform.name] = {
                type: userUniform.type,
                value: userUniform.valueGetter()
            }
        }

        const userCode = shaderInput.value;
        userUniforms = parseUniformDefs(userCode);
        updateUniformUI(prevUniformData);

        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        // insert user code into fragment shader
        gl.shaderSource(fragmentShader, fsText.replace("// YOUR CODE GOES HERE", userCode));
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            alert("Fragment shader (your code starting at line 9) failed to compile:\n"
                + gl.getShaderInfoLog(fragmentShader));
            return;
        }

        program = gl.createProgram()
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            alert("Shader program failed to link:\n" + gl.getProgramInfoLog(program));
            return;
        }

        console.log("Shader program compiled and linked succesfully.");
        const posLoc = gl.getAttribLocation(program, '_pos');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.useProgram(program);
    }

    function updateUniformUI(prevUniformData) {
        uniformControls.innerHTML = ""; // clear current controls

        for (const [uniformIndex, uniform] of userUniforms.entries()) {

            let prevValue = null;
            if (uniform.name in prevUniformData && uniform.type == prevUniformData[uniform.name].type) {
                // restore this value if possible
                prevValue = prevUniformData[uniform.name].value;
            }

            const id = "uniform-inp-" + uniformIndex;

            const div = document.createElement("div");
            div.className = "uniform-control";

            switch (uniform.control) {
                case UniformControlType.CHECKBOX:
                    {
                        const input = document.createElement("input");
                        input.setAttribute("type", "checkbox");
                        input.setAttribute("id", id);
                        div.appendChild(input);

                        const label = document.createElement("label");
                        label.setAttribute("for", id);
                        label.appendChild(document.createTextNode(uniform.name));
                        div.appendChild(label);

                        if ("defaultValue" in uniform) {
                            input.checked = uniform.defaultValue;
                        } else {
                            input.checked = true;
                        }

                        if (prevValue !== null) {
                            input.checked = (prevValue === 1);
                        }

                        uniform.valueGetter = () => (input.checked ? 1 : 0);
                    }
                    break;
                case UniformControlType.NUMBER:
                    {
                        const label = document.createElement("label");
                        label.setAttribute("for", id);
                        label.appendChild(document.createTextNode(uniform.name));
                        div.appendChild(label);

                        const input = document.createElement("input");
                        input.setAttribute("type", "number");
                        input.setAttribute("id", id);
                        input.value = "0";
                        div.appendChild(input);

                        if ("defaultValue" in uniform) {
                            input.value = uniform.defaultValue;
                        } else {
                            input.value = "0";
                        }

                        if (prevValue !== null) {
                            input.value = prevValue;
                        }

                        uniform.valueGetter = () => parseFloat(input.value);
                    }
                    break;
                case UniformControlType.RANGE:
                    {
                        const label = document.createElement("label");
                        label.setAttribute("for", id);
                        label.appendChild(document.createTextNode(uniform.name));
                        div.appendChild(label);

                        const input = document.createElement("input");
                        input.setAttribute("type", "range");
                        input.setAttribute("step", "any");
                        input.setAttribute("id", id);
                        div.appendChild(input);
                        
                        const numInput = document.createElement("input");
                        numInput.setAttribute("type", "number");
                        
                        div.appendChild(numInput);

                        if (uniform.logarithmic) {
                            input.setAttribute("min", Math.log(uniform.min));
                            input.setAttribute("max", Math.log(uniform.max));

                            if ("defaultValue" in uniform) {
                                input.value = Math.log(uniform.defaultValue);
                            } else {
                                input.value = Math.sqrt(Math.log(uniform.max) * Math.log(uniform.min));
                            }

                            if (prevValue !== null && prevValue >= uniform.min && prevValue <= uniform.max) {
                                input.value = Math.log(prevValue);
                            }

                            numInput.value = Math.exp(input.value);
    
                            input.addEventListener("change", (e) => {
                                numInput.value = Math.exp(input.value);
                            });
                            numInput.addEventListener("change", (e) => {
                                input.value = Math.log(numInput.value);
                            });
    
                            uniform.valueGetter = () => Math.exp(parseFloat(input.value));
                        } else {
                            input.setAttribute("min", uniform.min);
                            input.setAttribute("max", uniform.max);
                            
                            if ("defaultValue" in uniform) {
                                input.value = uniform.defaultValue;
                            } else {
                                input.value = (uniform.max + uniform.min) / 2;
                            }

                            if (prevValue !== null && prevValue >= uniform.min && prevValue <= uniform.max) {
                                input.value = prevValue;
                            }

                            numInput.value = input.value;

                            input.addEventListener("change", (e) => {
                                numInput.value = input.value;
                            });
                            numInput.addEventListener("change", (e) => {
                                input.value = numInput.value;
                            });
    
                            uniform.valueGetter = () => parseFloat(input.value);
                        }
                    }
                    break;
                case UniformControlType.SELECT:
                    {
                        const label = document.createElement("label");
                        label.setAttribute("for", id);
                        label.appendChild(document.createTextNode(uniform.name));
                        div.appendChild(label);

                        const selector = document.createElement("select");
                        selector.setAttribute("id", id);
                        selector.setAttribute("name", uniform.name);
                        for (const [choiceIndex, choice] of uniform.choices.entries()) {
                            const option = document.createElement("option");
                            option.setAttribute("value", choiceIndex);
                            option.appendChild(document.createTextNode(choice));
                            selector.appendChild(option);
                        }
                        div.appendChild(selector);

                        if (prevValue !== null && prevValue < uniform.choices.length) {
                            selector.selectedIndex = prevValue;
                        }

                        uniform.valueGetter = () => selector.selectedIndex;
                    }
                    break;
            }

            uniformControls.appendChild(div);
        }
    }

    function updateImageFromEXRBuffer(buffer) {
        gl.deleteTexture(texture);
        const texData = new EXRLoader().parse(buffer);
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // TODO: take into account texData.type
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, texData.width, texData.height, 0, gl.RGBA, gl.HALF_FLOAT, texData.data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        imageAspectRatio = texData.width / texData.height;
        canvas.width = texData.width;
        canvas.height = texData.height;
        // When Safari and Firefox implement drawingBufferStorage,
        // the sRGB IEOTF shader code can be removed and this used instead:
        // gl.drawingBufferStorage(gl.SRGB8_ALPHA8, texData.width, texData.height);
        gl.viewport(0, 0, texData.width, texData.height);
    }

    // main loop
    function update() {
        gl.uniform1f(gl.getUniformLocation(program, "_viewAspectRatio"), canvas.width / canvas.height);
        gl.uniform1f(gl.getUniformLocation(program, "_imageAspectRatio"), imageAspectRatio);
        gl.uniform1i(gl.getUniformLocation(program, "_tex"), 0);
        gl.uniform1f(gl.getUniformLocation(program, "_exposure"), Math.pow(2, exposureInput.value));

        for (const uniform of userUniforms) {
            const uniformLoc = gl.getUniformLocation(program, uniform.name);
            const uniformValue = uniform.valueGetter();
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

    // UI listeners
    compileButton.addEventListener("click", updateShader);
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            updateImageFromEXRBuffer(reader.result);
        };
        reader.readAsArrayBuffer(file);
    });

    // preset options
    for (const key of Object.keys(shaderPresets)) {
        const option = document.createElement("option");
        option.setAttribute("value", key);
        option.appendChild(document.createTextNode(key));
        presetSelect.appendChild(option);
    }

    presetSelect.addEventListener("change", (e) => {
        shaderInput.value = shaderPresets[presetSelect.value];
        updateShader();
    })

    // initial setup
    const fileLoader = new THREE.FileLoader();
    fileLoader.responseType = "arraybuffer";
    fileLoader.load("Shelf.exr", (data) => {
        updateImageFromEXRBuffer(data);
    });

    const initialPreset = "Multi";
    presetSelect.value = initialPreset;
    shaderInput.value = shaderPresets[initialPreset];
    updateShader();
    requestAnimationFrame(update);
});
