import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirTimeline from "./AirTimeline.vue";

const meta = {
  args: {
    items: [
      {
        detail: "ICN to NRT, 2h 05m block time",
        id: "outbound",
        meta: "09:00-11:05",
        title: "Outbound leg",
        tone: "success",
      },
      {
        detail: "Aircraft remains at the destination for turnaround",
        id: "turnaround",
        meta: "90m",
        title: "Turnaround",
        tone: "warning",
      },
      {
        detail: "NRT to ICN, return leg",
        id: "return",
        meta: "12:35-14:40",
        title: "Return leg",
        tone: "success",
      },
    ],
  },
  component: AirTimeline,
  tags: ["autodocs"],
  title: "Components/AirTimeline",
} satisfies Meta<typeof AirTimeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
