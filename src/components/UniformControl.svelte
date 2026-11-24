<script lang="ts">
    import { rgbToHex, hexToRgb } from "../hexColor";
    import type { ControllableUniformValue, UniformSpec } from "../uniformSpec";
    import RangeControl from "./RangeControl.svelte";

    const id = $props.id();

    let {
        value = $bindable(),
        uniformSpec,
    }: {
        value: ControllableUniformValue;
        uniformSpec: UniformSpec;
    } = $props();
</script>

<div class="control" class:inline={uniformSpec.control === "checkbox"}>
    {#if uniformSpec.control === "checkbox"}
        <input
            {id}
            type="checkbox"
            bind:checked={
                () => value as boolean,
                (v) => {
                    value = v;
                }
            }
        />
        <label for={id}>{uniformSpec.label || uniformSpec.name}</label>
    {:else}
        <label for={id}>{uniformSpec.label || uniformSpec.name}</label>
        {#if uniformSpec.control === "range"}
            <RangeControl
                {id}
                min={uniformSpec.min}
                max={uniformSpec.max}
                logarithmic={uniformSpec.logarithmic || false}
                bind:value={
                    () => value as number,
                    (v) => {
                        value = v;
                    }
                }
            ></RangeControl>
        {/if}
        {#if uniformSpec.control === "number"}
            <input
                {id}
                type="number"
                bind:value={
                    () => value as number,
                    (v) => {
                        value = v;
                    }
                }
            />
        {/if}
        {#if uniformSpec.control === "select"}
            <select
                {id}
                bind:value={
                    () => value as number,
                    (v) => {
                        value = v;
                    }
                }
            >
                {#each uniformSpec.options as option, index}
                    <option value={index}>{option}</option>
                {/each}
            </select>
        {/if}
        {#if uniformSpec.control === "color"}
            <input
                {id}
                type="color"
                bind:value={
                    () => rgbToHex(value as [number, number, number]),
                    (v) => (value = hexToRgb(v))
                }
            />
        {/if}
    {/if}
</div>
