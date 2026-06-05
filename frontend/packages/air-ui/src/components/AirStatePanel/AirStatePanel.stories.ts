import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirButton from "../AirButton";
import AirStatePanel from "./AirStatePanel.vue";

const meta = {
  args: {
    body: "The last cached data is still available while the service recovers.",
    title: "Route data is temporarily unavailable",
    tone: "warning",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["info", "success", "warning", "danger"],
    },
  },
  component: AirStatePanel,
  tags: ["autodocs"],
  title: "Components/AirStatePanel",
} satisfies Meta<typeof AirStatePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithAction: Story = {
  render: () => ({
    components: { AirButton, AirStatePanel },
    template: `
      <AirStatePanel title="No saved routes yet" body="Create a route from the planner to unlock scheduling." tone="info">
        <template #action>
          <AirButton label="Refresh" size="sm" />
        </template>
      </AirStatePanel>
    `,
  }),
};
