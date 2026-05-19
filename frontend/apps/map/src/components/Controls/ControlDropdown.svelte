<script lang="ts">
    type DropdownOption = {
        label: string;
        value: string;
    };

    type Props = {
        change: (value: string) => void;
        options: readonly DropdownOption[];
    };

    const { change, options }: Props = $props();

    function onChange(event: Event): void {
        const select = event.currentTarget;

        if (select instanceof HTMLSelectElement) {
            change(select.value);
        }
    }
</script>

<select
    onchange={onChange}
    class="px-4 py-2.5 bg-transparent border-b border-border cursor-pointer font-bold transition-colors duration-300 hover:bg-surface-subtle appearance-none"
>
    {#each options as option (option.value)}
        <option value={option.value}>{option.label}</option>
    {/each}
</select>
