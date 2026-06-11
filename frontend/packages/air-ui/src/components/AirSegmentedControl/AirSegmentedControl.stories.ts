import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { ref } from "vue";

import AirSegmentedControl from "./AirSegmentedControl.vue";

const meta = {
  args: {
    disabled: false,
    label: "View mode",
    modelValue: "timeline",
    options: [
      { label: "Timeline", value: "timeline" },
      { label: "Table", value: "table" },
      { label: "Metrics", value: "metrics" },
    ],
  },
  component: AirSegmentedControl,
  tags: ["autodocs"],
  title: "Components/AirSegmentedControl",
} satisfies Meta<typeof AirSegmentedControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { AirSegmentedControl },
    setup: () => {
      const selected = ref(args.modelValue);

      return { args, selected };
    },
    template: `
      <AirSegmentedControl
        v-bind="args"
        :model-value="selected"
        @select="selected = $event"
      />
    `,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
