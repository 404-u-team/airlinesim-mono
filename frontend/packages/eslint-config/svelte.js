import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint, { parser as typescriptParser } from "typescript-eslint";

import baseConfig from "./base.js";

export default tseslint.config(
  ...baseConfig,
  ...svelte.configs.recommended,
  {
    files: ["**/*.svelte", "**/*.svelte.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: typescriptParser,
        projectService: true,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "svelte/button-has-type": "error",
      "svelte/no-at-debug-tags": "error",
      "svelte/no-dom-manipulating": "error",
      "svelte/no-dupe-else-if-blocks": "error",
      "svelte/no-dupe-on-directives": "error",
      "svelte/no-dupe-style-properties": "error",
      "svelte/no-immutable-reactive-statements": "error",
      "svelte/no-inline-styles": "error",
      "svelte/no-navigation-without-resolve": "error",
      "svelte/no-not-function-handler": "error",
      "svelte/no-object-in-text-mustaches": "error",
      "svelte/no-reactive-functions": "error",
      "svelte/no-reactive-literals": "error",
      "svelte/no-svelte-internal": "error",
      "svelte/no-target-blank": "error",
      "svelte/no-unused-class-name": [
        "error",
        {
          allowedClassNames: [
            "/^([a-z0-9-]+:)*-?[a-z][a-z0-9]*(?:-[a-z0-9/.[\\]#%]+)*$/u",
          ],
        },
      ],
      "svelte/prefer-class-directive": "error",
      "svelte/prefer-destructured-store-props": "error",
      "svelte/prefer-style-directive": "error",
      "svelte/require-each-key": "error",
      "svelte/require-store-reactive-access": "error",
    },
  },
);
