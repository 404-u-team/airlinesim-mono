import config from "@airlinesim/eslint-config/base";

export default [
  ...config,
  {
    files: ["src/modules/import/**/*.ts"],
    rules: {
      "complexity": "off",
      "no-await-in-loop": "off",
      "perfectionist/sort-imports": "off",
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-named-imports": "off",
      "perfectionist/sort-object-types": "off",
    },
  },
];
