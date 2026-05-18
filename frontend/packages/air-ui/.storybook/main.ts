import type { StorybookConfig } from "@storybook/vue3-vite";

import tailwindcss from "@tailwindcss/vite";
import { dirname } from "path";
import { fileURLToPath } from "url";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  addons: [],
  framework: getAbsolutePath("@storybook/vue3-vite"),
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  viteFinal: (config) => {
    config.plugins = [...(config.plugins ?? []), tailwindcss()];

    return config;
  },
};

export default config;
