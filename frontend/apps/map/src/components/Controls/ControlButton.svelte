<script lang="ts">
    let { click } = $props();
</script>

<div onclick={click} aria-label="button" role="button">
    <slot />
</div>

<style scoped>
    div {
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

    div:last-child {
        border-bottom: none;
    }

    div:hover {
        background: #f0f0f0;
        transition: background-color 0.3s ease;
    }
</style>
