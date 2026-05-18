import requireMinVersion from "../rules/require-min-version.js";

const config = {
  plugins: {
    "obsidian-minimum-required-version": {
      rules: {
        "require-min-version": requireMinVersion,
      },
    },
  },
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
  rules: {
    "obsidian-minimum-required-version/require-min-version": "warn",
  },
};

export default config;
