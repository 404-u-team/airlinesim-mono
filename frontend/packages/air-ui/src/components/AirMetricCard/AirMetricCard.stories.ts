import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirMetricCard from "./AirMetricCard.vue";

const meta = {
  args: {
    hint: "Compared with current operating baseline.",
    label: "Fleet value",
    tone: "neutral",
    value: "$124,000,000",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "success", "warning", "danger"],
    },
  },
  component: AirMetricCard,
  tags: ["autodocs"],
  title: "Components/AirMetricCard",
} satisfies Meta<typeof AirMetricCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => ({
    components: { AirMetricCard },
    template: `
      <div class="grid w-[720px] grid-cols-4 gap-3">
        <AirMetricCard label="Neutral" value="42" tone="neutral" />
        <AirMetricCard label="Success" value="Ready" tone="success" />
        <AirMetricCard label="Warning" value="Review" tone="warning" />
        <AirMetricCard label="Danger" value="Blocked" tone="danger" />
      </div>
    `,
  }),
};
