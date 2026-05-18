import requireMinVersion from "./rules/require-min-version.js";
import recommended from "./configs/recommended.js";
import recommendedTypeChecked from "./configs/recommended-type-checked.js";

const plugin = {
  rules: {
    "require-min-version": requireMinVersion,
  },
  configs: {
    recommended,
    recommendedTypeChecked,
  },
};

export default plugin;
