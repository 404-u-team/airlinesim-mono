import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirTextField from "./AirTextField.vue";

const meta = {
  args: {
    autocomplete: "username",
    disabled: false,
    error: undefined,
    hint: "Use 3-50 characters.",
    label: "Nickname",
    modelValue: "",
    name: "nickname",
    placeholder: "captain-kim",
    required: false,
    type: "text",
  },
  argTypes: {
    type: {
      control: "inline-radio",
      options: ["text", "email", "password", "search"],
    },
  },
  component: AirTextField,
  tags: ["autodocs"],
  title: "Components/AirTextField",
} satisfies Meta<typeof AirTextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Error: Story = {
  args: {
    error: "Password must be at least 8 characters.",
    hint: undefined,
    label: "Password",
    modelValue: "short",
    type: "password",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    modelValue: "captain-kim",
  },
};
