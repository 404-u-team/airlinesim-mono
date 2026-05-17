<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        children?: Snippet;
        click: (event: MouseEvent) => void;
    };

    const { children, click }: Props = $props();
</script>

<button
    type="button"
    onclick={click}
    class="flex items-center justify-center px-4 py-2.5 bg-transparent border-b border-border last:border-b-0 cursor-pointer font-bold transition-colors duration-300 hover:bg-surface-subtle"
>
    {@render children?.()}
</button>
