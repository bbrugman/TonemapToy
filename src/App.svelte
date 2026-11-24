<script lang="ts">
    import { untrack } from "svelte";
    import {
        initGLState,
        compile,
        updateImageFromEXRBuffer,
        draw,
        imageInputUniforms,
        sharedLookUniforms,
        setUniforms,
    } from "./webGL";
    import UniformControl from "./components/UniformControl.svelte";
    import type { ControllableUniformValue, UniformSpec } from "./uniformSpec";
    import {
        curvePresets,
        fullPresets,
        methodPresets,
    } from "./presets/presets";
    import { FileLoader } from "three";
    import shelfUrl from "./assets/Shelf.exr";

    let drawCount: number = $state(0);
    let userCode: string = $state("");
    let userUniformValues: Record<string, ControllableUniformValue> = $state(
        {},
    );
    let imageInputUniformValues: Record<string, ControllableUniformValue> =
        $state({});
    let sharedLookUniformValues: Record<string, ControllableUniformValue> =
        $state({});

    let userUniforms: UniformSpec[] = $state([]);

    let editor: HTMLTextAreaElement;

    function updateImage(e: Event) {
        const file = (e.currentTarget as HTMLInputElement).files![0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            updateImageFromEXRBuffer(reader.result as ArrayBuffer);
            drawCount++;
        };
        reader.readAsArrayBuffer(file);
    }

    function tryCompile() {
        const newUserUniforms = compile(editor.value);
        if (newUserUniforms) {
            userCode = editor.value;
            userUniforms = newUserUniforms;
            correctUniformValues(newUserUniforms);
            return true;
        }
        return false;
    }

    function resetUniformValues() {
        userUniformValues = {};
        correctUniformValues(userUniforms);
    }

    function correctUniformValues(newUserUniforms: UniformSpec[]) {
        for (const userUniform of newUserUniforms) {
            const prevValue = userUniformValues[userUniform.name];
            const alreadyDefined = prevValue !== undefined;

            const sameType =
                (userUniform.type === "bool" &&
                    typeof prevValue === "boolean") ||
                (["float", "int", "uint"].includes(userUniform.type) &&
                    typeof prevValue === "number") ||
                (userUniform.type === "vec3" && Array.isArray(prevValue));

            const outOfBounds =
                typeof prevValue === "number" &&
                ((userUniform.control === "range" &&
                    (userUniform.min > prevValue ||
                        userUniform.max < prevValue)) ||
                    (userUniform.control === "select" &&
                        prevValue >= userUniform.options.length));

            if (!alreadyDefined || !sameType || outOfBounds) {
                userUniformValues[userUniform.name] = userUniform.defaultValue;
            } // otherwise, maintain the previous value
        }
    }

    $effect(() => {
        drawCount;
        setUniforms(
            $state.snapshot({
                ...userUniformValues,
                ...sharedLookUniformValues,
                ...imageInputUniformValues,
            }),
        );
        draw();
    });

    type Look = {
        userCode: string;
        userUniformValues: Record<string, ControllableUniformValue>;
        sharedLookUniformValues: Record<string, ControllableUniformValue>;
    };

    let storedLook: Look | null = $state.raw(null);

    function swapLook() {
        const newStoredLook = $state.snapshot({
            userCode,
            userUniformValues,
            sharedLookUniformValues,
        });
        if (storedLook !== null) {
            const specs = compile(storedLook.userCode);
            if (!specs) return;
            editor.value = storedLook.userCode;
            userCode = storedLook.userCode;
            userUniforms = specs;
            userUniformValues = storedLook.userUniformValues;
            sharedLookUniformValues = storedLook.sharedLookUniformValues;
            drawCount++;
        }
        storedLook = newStoredLook;
    }

    let selectedPreset = $state("Blank");
    let selectedMethod = $state("~AgX");
    let selectedCurve = $state("Film Print");

    let presetCode = $derived(
        selectedPreset !== "<Combi>"
            ? fullPresets[selectedPreset]
            : curvePresets[selectedCurve] +
                  "\n\n" +
                  methodPresets[selectedMethod],
    );

    function applyPreset() {
        editor.value = presetCode;
        if (tryCompile()) drawCount++;
    }

    const exampleImageData = new Promise(
        (resolve: (value: ArrayBuffer) => void, reject) => {
            const fileLoader = new FileLoader<ArrayBuffer>();
            fileLoader.responseType = "arraybuffer";
            fileLoader.load(
                shelfUrl,
                (data) => {
                    resolve(data);
                },
                () => {},
                (err) => {
                    reject(err);
                },
            );
        },
    );

    function setup(node: HTMLCanvasElement) {
        initGLState(node);
        untrack(() => {
            editor.value = presetCode;
            for (const uniform of imageInputUniforms) {
                imageInputUniformValues[uniform.name] = uniform.defaultValue;
            }
            for (const uniform of sharedLookUniforms) {
                sharedLookUniformValues[uniform.name] = uniform.defaultValue;
            }
            tryCompile();
            exampleImageData.then((data) => {
                updateImageFromEXRBuffer(data);
                drawCount++;
            });
        });
    }
</script>

<header><h1>TonemapToy</h1></header>
<div id="layout">
    <div id="controls">
        <section id="image-controls">
            <div class="control">
                <label for="image-button">EXR image file</label>
                <input id="image-button" type="file" onchange={updateImage} />
            </div>
            {#each imageInputUniforms as uniformSpec (uniformSpec.name)}
                <UniformControl
                    {uniformSpec}
                    bind:value={imageInputUniformValues[uniformSpec.name]}
                ></UniformControl>
            {/each}
        </section>
        <section id="generic-controls">
            <button onclick={swapLook}
                >{#if storedLook === null}Store{:else}Swap{/if} look</button
            >
            {#each sharedLookUniforms as uniformSpec (uniformSpec.name)}
                <UniformControl
                    {uniformSpec}
                    bind:value={sharedLookUniformValues[uniformSpec.name]}
                ></UniformControl>
            {/each}
        </section>
        <section id="shader-controls">
            <div class="control">
                <label for="preset-select">Shader preset</label>
                <select
                    bind:value={
                        () => selectedPreset,
                        (v) => {
                            selectedPreset = v;
                            applyPreset();
                        }
                    }
                    id="preset-select"
                >
                    {#each Object.keys(fullPresets) as preset}
                        <option>{preset}</option>
                    {/each}
                    <option>&lt;Combi&gt;</option>
                </select>
                {#if selectedPreset === "<Combi>"}
                    <label for="method-select">Method</label>
                    <select
                        bind:value={
                            () => selectedMethod,
                            (v) => {
                                selectedMethod = v;
                                applyPreset();
                            }
                        }
                        id="method-select"
                    >
                        {#each Object.keys(methodPresets) as preset}
                            <option>{preset}</option>
                        {/each}
                    </select>
                    <label for="curve-select">Curve</label>
                    <select
                        bind:value={
                            () => selectedCurve,
                            (v) => {
                                selectedCurve = v;
                                applyPreset();
                            }
                        }
                        id="curve-select"
                    >
                        {#each Object.keys(curvePresets) as preset}
                            <option>{preset}</option>
                        {/each}
                    </select>
                {/if}
            </div>
            <div class="control">
                <label for="editor">GLSL</label>
                <textarea rows="15" cols="72" id="editor" bind:this={editor}
                ></textarea>
            </div>
            <div class="control inline">
                <button
                    onclick={() => {
                        tryCompile();
                        drawCount++;
                    }}>Compile</button
                >
                <button onclick={resetUniformValues}
                    >Reset uniform values to default</button
                >
            </div>
        </section>
        <section id="uniform-controls">
            {#each userUniforms as uniformSpec (uniformSpec.name)}
                <UniformControl
                    {uniformSpec}
                    bind:value={userUniformValues[uniformSpec.name]}
                ></UniformControl>
            {/each}
        </section>
    </div>
    <div id="canvas-holder">
        <canvas {@attach setup}></canvas>
    </div>
</div>
