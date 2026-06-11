import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirImagePreview from "./AirImagePreview.vue";

const meta = {
  args: {
    alt: "Storybook Image Preview",
    aspectRatio: "video",
    fit: "cover",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e9/F-WWOW_A380_Marseille.jpg",
  },
  argTypes: {
    aspectRatio: {
      control: "select",
      options: ["auto", "square", "video", "wide"],
    },
    fit: {
      control: "inline-radio",
      options: ["cover", "contain"],
    },
    src: {
      control: "text",
    },
  },
  component: AirImagePreview,
  tags: ["autodocs"],
  title: "Components/AirImagePreview",
} satisfies Meta<typeof AirImagePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    src: "",
  },
};

export const ErrorState: Story = {
  args: {
    src: "https://invalid-domain.xyz/nonexistent-image.jpg",
  },
};

export const SquareRatio: Story = {
  args: {
    aspectRatio: "square",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e9/F-WWOW_A380_Marseille.jpg",
  },
};
