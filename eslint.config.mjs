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
  {
    // Clean Architecture dependency rule (ADR-0017): domain/application
    // must never import frameworks, Prisma, or vendor SDKs.
    files: ["src/domain/**", "src/application/**"],
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/**", "react", "react/**", "@prisma/**", "prisma", "openai", "**/generated/**", "**/infrastructure/**"],
              message: "domain/application must not import frameworks or infrastructure (ADR-0017). Depend on ports only.",
            },
          ],
        },
      ],
    },
  },
  { ignores: ["node_modules/**", ".next/**", "generated/**"] },
];
