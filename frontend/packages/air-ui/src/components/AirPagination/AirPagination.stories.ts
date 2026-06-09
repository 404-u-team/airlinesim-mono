import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { ref } from "vue";

import AirPagination from "./AirPagination.vue";

const meta = {
  args: {
    disabled: false,
    page: 4,
    pageSize: 10,
    totalItems: 126,
  },
  argTypes: {
    page: {
      control: { min: 1, type: "number" },
    },
    pageSize: {
      control: { min: 1, type: "number" },
    },
    totalItems: {
      control: { min: 0, type: "number" },
    },
  },
  component: AirPagination,
  tags: ["autodocs"],
  title: "Components/AirPagination",
} satisfies Meta<typeof AirPagination>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { AirPagination },
    setup: () => {
      const page = ref(args.page);

      return { args, page };
    },
    template: `
      <div class="max-w-3xl overflow-hidden rounded-lg border border-border bg-surface">
        <AirPagination
          v-bind="args"
          v-model:page="page"
        />
      </div>
    `,
  }),
};

export const Empty: Story = {
  args: {
    page: 1,
    pageSize: 10,
    totalItems: 0,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
