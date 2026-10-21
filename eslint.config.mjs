import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "assets/**", "scripts/**", "**/bench/**"] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "error", "no-eval": "error", "no-implied-eval": "error", "no-new-func": "error" } },
);
