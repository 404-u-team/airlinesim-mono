<script lang="ts">
    let { click } = $props();
</script>

<div
    onclick={click}
    aria-label="button"
    role="button"
    class="flex items-center justify-center px-4 py-2.5 bg-transparent border-b border-border last:border-b-0 cursor-pointer font-bold transition-colors duration-300 hover:bg-surface-subtle"
>
    <slot />
</div>
