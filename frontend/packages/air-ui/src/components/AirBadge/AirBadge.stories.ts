import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirBadge from "./AirBadge.vue";

type AirBadgeStoryArgs = {
    label?: string;
    size?: "lg" | "md" | "sm";
    variant?: (typeof variants)[number];
};

const variants = [
    "primary",
    "primary-soft",
    "success",
    "success-soft",
    "warning",
    "warning-soft",
    "danger",
    "danger-soft",
] as const;

const meta = {
    args: {
        label: "Badge",
        size: "md",
        variant: "primary",
    },
    argTypes: {
        size: {
            control: "inline-radio",
            options: ["sm", "md", "lg"],
        },
        variant: {
            control: "select",
            options: variants,
        },
    },
    component: AirBadge,
    tags: ["autodocs"],
    title: "Components/AirBadge",
} satisfies Meta<typeof AirBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
    render: (args: AirBadgeStoryArgs) => ({
        components: { AirBadge },
        setup: (): { args: AirBadgeStoryArgs; variants: typeof variants } => {
            return { args, variants };
        },
        template: `
      <div class="inline-flex flex-col gap-6 rounded-lg border border-dashed border-violet-500 bg-surface-subtle p-6 w-max">
        <AirBadge
          v-for="variant in variants"
          :key="variant"
          v-bind="args"
          :variant="variant"
        />
      </div>
    `,
    }),
};