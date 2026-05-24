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
  {
    files: ["src/modules/proxy/**/*.ts"],
    rules: {
      "no-await-in-loop": "off",
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-objects": "off",
    },
  },
  {
    files: ["src/scripts/**/*.ts"],
    rules: {
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-sets": "off",
      "perfectionist/sort-union-types": "off",
    },
  },
];
