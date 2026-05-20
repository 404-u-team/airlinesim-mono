import type { Meta, StoryObj } from "@storybook/vue3-vite";

import AirBadge from "../AirBadge/AirBadge.vue";
import AirButton from "../AirButton/AirButton.vue";
import AirTextField from "../AirTextField/AirTextField.vue";
import AirFormPanel from "./AirFormPanel.vue";

const meta = {
  args: {
    description: "Use your captain credentials to continue the simulation.",
    title: "Sign in",
  },
  component: AirFormPanel,
  tags: ["autodocs"],
  title: "Components/AirFormPanel",
} satisfies Meta<typeof AirFormPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { AirBadge, AirButton, AirFormPanel, AirTextField },
    setup: () => {
      return { args };
    },
    template: `
      <div class="flex min-h-[420px] items-center justify-center bg-background p-6">
        <AirFormPanel v-bind="args">
          <template #eyebrow>
            <AirBadge
              class="mb-3"
              label="AirlineSim Korea"
              variant="primary-soft"
            />
          </template>

          <form class="space-y-4">
            <AirTextField
              autocomplete="username"
              label="Login"
              model-value="captain-kim"
              name="login"
              required
            />
            <AirTextField
              autocomplete="current-password"
              label="Password"
              model-value=""
              name="password"
              required
              type="password"
            />
            <AirButton
              class="w-full"
              label="Sign in"
              type="submit"
            />
          </form>
        </AirFormPanel>
      </div>
    `,
  }),
};

export const Register: Story = {
  args: {
    description: "Register a player profile and start a new airline session.",
    title: "Create airline account",
  },
};
