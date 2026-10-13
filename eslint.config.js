import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  { files: ["**/*.js"], languageOptions: { globals: globals.node } },
  {
    files: ["frontend/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
];
