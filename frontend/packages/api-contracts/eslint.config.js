import config from "@airlinesim/eslint-config/base";

export default [
  ...config,
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "max-nested-callbacks": "off",
      "perfectionist/sort-modules": "off",
    },
  },
];
