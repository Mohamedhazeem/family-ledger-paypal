import core from "@eslint/js";
import nextPlugin from "eslint-config-next";

export default [
  core.configs.recommended,
  ...nextPlugin,
  {
    rules: {
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "Do not use parseFloat for money; convert at the boundary with decimal.js (ADR-0003).",
        },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/services/**"],
    rules: {
      "no-console": "error",
    },
  },
  { ignores: ["node_modules/**", ".next/**", "generated/**"] },
];
