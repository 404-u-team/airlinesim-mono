import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirSelect from "./AirSelect.vue";

const meta = {
  args: {
    disabled: false,
    label: "Map style",
    modelValue: "positron",
    options: [
      { label: "Positron", value: "positron" },
      { label: "Dark Matter", value: "dark-matter" },
      { label: "ArcGIS Hybrid", value: "arcgis-hybrid" },
    ],
  },
  component: AirSelect,
  tags: ["autodocs"],
  title: "Components/AirSelect",
} satisfies Meta<typeof AirSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
