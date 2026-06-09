import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirProgressBar from "./AirProgressBar.vue";

const meta = {
  args: {
    percent: 60,
    tone: "primary",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "primary", "success", "warning", "danger"],
    },
  },
  component: AirProgressBar,
  tags: ["autodocs"],
  title: "Components/AirProgressBar",
} satisfies Meta<typeof AirProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => ({
    components: { AirProgressBar },
    template: `
      <div class="grid w-[480px] gap-4">
        <div>
          <span class="text-caption mb-1 block">Primary (60%)</span>
          <AirProgressBar :percent="60" tone="primary" />
        </div>
        <div>
          <span class="text-caption mb-1 block">Success (85%)</span>
          <AirProgressBar :percent="85" tone="success" />
        </div>
        <div>
          <span class="text-caption mb-1 block">Warning (95%)</span>
          <AirProgressBar :percent="95" tone="warning" />
        </div>
        <div>
          <span class="text-caption mb-1 block">Danger (100%)</span>
          <AirProgressBar :percent="100" tone="danger" />
        </div>
        <div>
          <span class="text-caption mb-1 block">Neutral (30%)</span>
          <AirProgressBar :percent="30" tone="neutral" />
        </div>
      </div>
    `,
  }),
};
