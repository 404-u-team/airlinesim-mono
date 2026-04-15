<script lang="ts">
    let { change, options, values } = $props();
</script>

<select onchange={change}>
    {#each options as option, i}
        <option value={values[i]}>{option}</option>
    {/each}
</select>

<style scoped>
    select {
        padding: 10px 15px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-weight: bold;
        border-bottom: 1px solid #eee;
        transition: background-color 0.3s ease;
        align-items: center;
        justify-content: center;
        display: flex;
    }

    select:last-child {
        border-bottom: none;
    }

    select:hover {
        background: #f0f0f0;
        transition: background-color 0.3s ease;
    }
</style>
