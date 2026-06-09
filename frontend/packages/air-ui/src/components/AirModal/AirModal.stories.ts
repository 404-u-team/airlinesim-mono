import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { ref } from "vue";

import AirButton from "../AirButton";
import AirModal from "./AirModal.vue";

const meta = {
  args: {
    open: true,
    size: "md",
    title: "How is demand calculated?",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
  component: AirModal,
  tags: ["autodocs"],
  title: "Components/AirModal",
} satisfies Meta<typeof AirModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { AirModal },
    setup: () => ({ args }),
    template: `
      <AirModal v-bind="args">
        <p class="text-body text-text-muted">
          Demand is estimated with a gravity model on population, GDP and distance.
        </p>
      </AirModal>
    `,
  }),
};

export const Toggleable: Story = {
  render: () => ({
    components: { AirButton, AirModal },
    setup: () => {
      const open = ref(false);

      return { open };
    },
    template: `
      <div>
        <AirButton label="Open modal" @click="open = true" />
        <AirModal :open="open" title="Details" @close="open = false">
          <p class="text-body">Modal body content.</p>
          <template #footer>
            <div class="flex justify-end">
              <AirButton label="Close" size="sm" @click="open = false" />
            </div>
          </template>
        </AirModal>
      </div>
    `,
  }),
};
