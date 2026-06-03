import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirCombobox from "./AirCombobox.vue";

const meta = {
  args: {
    disabled: false,
    emptyText: "No airports found",
    label: "Select base airport",
    loading: false,
    loadingText: "Loading airports...",
    modelValue: "IST",
    options: [
      { label: "Istanbul Airport (IST)", value: "IST" },
      { label: "London Heathrow (LHR)", value: "LHR" },
      { label: "John F. Kennedy (JFK)", value: "JFK" },
    ],
    placeholder: "Search base...",
  },
  component: AirCombobox,
  tags: ["autodocs"],
  title: "Components/AirCombobox",
} satisfies Meta<typeof AirCombobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    emptyText: "Nothing found matching your query",
    options: [],
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
export const ErrorState: Story = {
  args: {
    error: "Please select a valid airport from the list.",
  },
};
