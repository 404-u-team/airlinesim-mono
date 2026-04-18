<script lang="ts">
    let { change, options, values } = $props();
</script>

<select
    onchange={change}
    class="px-4 py-2.5 bg-transparent border-b border-border cursor-pointer font-bold transition-colors duration-300 hover:bg-surface-subtle appearance-none"
>
    {#each options as option, i}
        <option value={values[i]}>{option}</option>
    {/each}
</select>
