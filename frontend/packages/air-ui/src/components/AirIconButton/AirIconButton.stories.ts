import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirIconButton from "./AirIconButton.vue";

const meta = {
  args: {
    active: false,
    disabled: false,
    label: "Zoom in",
    size: "md",
    variant: "surface",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg"],
    },
    variant: {
      control: "inline-radio",
      options: ["surface", "primary"],
    },
  },
  component: AirIconButton,
  tags: ["autodocs"],
  title: "Components/AirIconButton",
} satisfies Meta<typeof AirIconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { AirIconButton },
    setup: () => ({ args }),
    template: `
      <AirIconButton v-bind="args">
        <span class="text-subtitle leading-none">+</span>
      </AirIconButton>
    `,
  }),
};

export const States: Story = {
  render: () => ({
    components: { AirIconButton },
    template: `
      <div class="inline-flex gap-3 rounded-lg border border-dashed border-border bg-surface-subtle p-4">
        <AirIconButton label="Default"><span class="text-subtitle">+</span></AirIconButton>
        <AirIconButton label="Active" active><span class="text-subtitle">3D</span></AirIconButton>
        <AirIconButton label="Disabled" disabled><span class="text-subtitle">-</span></AirIconButton>
      </div>
    `,
  }),
};
