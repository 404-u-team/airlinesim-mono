import config from "@airlinesim/eslint-config/vue";

export default [
  ...config,
  {
    settings: {
      "import-x/core-modules": ["map/Map"],
    },
  },
];
