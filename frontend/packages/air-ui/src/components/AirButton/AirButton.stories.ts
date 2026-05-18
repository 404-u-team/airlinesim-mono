import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirButton from "./AirButton.vue";

type AirButtonStoryArgs = {
  disabled?: boolean;
  label?: string;
  size?: "lg" | "md" | "sm";
  type?: "button" | "reset" | "submit";
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
    disabled: false,
    label: "Action",
    size: "md",
    type: "button",
    variant: "primary",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    type: {
      control: "inline-radio",
      options: ["button", "submit", "reset"],
    },
    variant: {
      control: "select",
      options: variants,
    },
  },
  component: AirButton,
  tags: ["autodocs"],
  title: "Components/AirButton",
} satisfies Meta<typeof AirButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: (args: AirButtonStoryArgs) => ({
    components: { AirButton },
    setup: (): { args: AirButtonStoryArgs; variants: typeof variants } => {
      return { args, variants };
    },
    template: `
      <div class="inline-flex flex-col gap-6 rounded-lg border border-dashed border-violet-500 bg-surface-subtle p-6">
        <AirButton
          v-for="variant in variants"
          :key="variant"
          v-bind="args"
          :variant="variant"
        />
      </div>
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
