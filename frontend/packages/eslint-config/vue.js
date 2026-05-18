import vue from "eslint-plugin-vue";
import tseslint, { parser as typescriptParser } from "typescript-eslint";

import baseConfig from "./base.js";

export default tseslint.config(
  ...baseConfig,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".vue"],
        parser: typescriptParser,
        projectService: true,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "vue/block-lang": [
        "error",
        {
          script: { lang: "ts" },
        },
      ],
      "vue/block-order": [
        "error",
        {
          order: ["script", "template", "style"],
        },
      ],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/component-name-in-template-casing": ["error", "PascalCase"],
      "vue/custom-event-name-casing": ["error", "kebab-case"],
      "vue/define-macros-order": [
        "error",
        {
          order: ["defineOptions", "defineProps", "defineEmits", "defineSlots"],
        },
      ],
      "vue/html-button-has-type": "error",
      "vue/html-self-closing": [
        "error",
        {
          html: {
            component: "always",
            normal: "always",
            void: "always",
          },
          math: "always",
          svg: "always",
        },
      ],
      "vue/max-attributes-per-line": [
        "error",
        {
          multiline: { max: 1 },
          singleline: { max: 3 },
        },
      ],
      "vue/multi-word-component-names": "error",
      "vue/no-empty-component-block": "error",
      "vue/no-multiple-objects-in-class": "error",
      "vue/no-ref-object-reactivity-loss": "error",
      "vue/no-required-prop-with-default": "error",
      "vue/no-root-v-if": "error",
      "vue/no-static-inline-styles": "error",
      "vue/no-template-target-blank": "error",
      "vue/no-undef-components": "error",
      "vue/no-unused-refs": "error",
      "vue/no-use-v-else-with-v-for": "error",
      "vue/no-useless-mustaches": "error",
      "vue/no-useless-v-bind": "error",
      "vue/padding-line-between-blocks": "error",
      "vue/prefer-define-options": "error",
      "vue/prefer-separate-static-class": "error",
      "vue/require-typed-ref": "error",
    },
  },
);
