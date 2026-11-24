<script lang="ts">
    let {
        value = $bindable(),
        min,
        max,
        logarithmic,
        id
    }: {
        value: number;
        min: number;
        max: number;
        logarithmic: boolean;
        id?: string;
    } = $props();

    const toRangeValue = (value: number) => {
        if (!logarithmic) return value;
        return Math.log(Math.max(value || min, min));
    };
    const fromRangeValue = (rangeValue: number) => (logarithmic ? Math.exp(rangeValue) : rangeValue);

    let rangeValueMin = $derived(toRangeValue(min));
    let rangeValueMax = $derived(toRangeValue(max));
</script>

<div class="range">
    <input
        type="range"
        step="any"
        {id}
        min={rangeValueMin}
        max={rangeValueMax}
        bind:value={() => toRangeValue(value), (v) => (value = fromRangeValue(v))}
    />
    <input type="number" step="any" {min} {max} bind:value/>
</div>
<style>
   .range { display: flex; align-items: center; gap: .5rem; }
</style>
