import js from "@eslint/js";
import { flatConfigs as importXConfigs } from "eslint-plugin-import-x";
import { configs as perfectionistConfigs } from "eslint-plugin-perfectionist";
import globals from "globals";
import tseslint, { configs as tseslintConfigs } from "typescript-eslint";

const ignores = [
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/node_modules/**",
  "**/.__mf__temp/**",
  "**/.turbo/**",
  "**/.storybook-static/**",
  "**/storybook-static/**",
  "**/*.d.ts",
];

const languageGlobals = {
  ...globals.browser,
  ...globals.builtin,
  ...globals.es2024,
  ...globals.node,
  ...globals.bun,
};

export default tseslint.config(
  {
    ignores,
  },

  js.configs.recommended,
  perfectionistConfigs["recommended-natural"],
  importXConfigs.recommended,
  importXConfigs.typescript,

  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: languageGlobals,
      sourceType: "module",
    },
    rules: {
      "array-callback-return": "error",
      "block-scoped-var": "error",
      "complexity": ["error", 12],
      "curly": ["error", "all"],
      "eqeqeq": ["error", "always", { null: "ignore" }],

      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
      "import-x/no-cycle": "error",
      "import-x/no-extraneous-dependencies": "error",

      "logical-assignment-operators": ["error", "always"],
      "max-depth": ["error", 3],
      "max-lines": ["error", { max: 350, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
      "max-nested-callbacks": ["error", 2],
      "no-alert": "error",
      "no-await-in-loop": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-constructor-return": "error",
      "no-duplicate-imports": "error",
      "no-else-return": "error",
      "no-implicit-coercion": "error",
      "no-lonely-if": "error",
      "no-multi-assign": "error",
      "no-nested-ternary": "error",
      "no-param-reassign": "error",
      "no-promise-executor-return": "error",
      "no-return-await": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": ["error", { enforceForJSX: true }],
      "no-var": "error",
      "object-shorthand": ["error", "always"],
      "one-var": ["error", "never"],
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-destructuring": [
        "error",
        {
          AssignmentExpression: { array: false, object: false },
          VariableDeclarator: { array: false, object: true },
        },
        { enforceForRenamedProperties: false },
      ],
      "prefer-template": "error",
      "radix": "error",
      "require-atomic-updates": "error",
      "yoda": "error",
    },
    settings: {
      "import-x/resolver": {
        node: true,
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },

  ...tseslintConfigs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  ...tseslintConfigs.stylisticTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-arguments": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/promise-function-async": "error",
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  }
);
