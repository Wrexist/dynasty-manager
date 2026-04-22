import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".claude/worktrees"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Centralize all localStorage / sessionStorage access in
  // src/store/helpers/persistence.ts. This rule prevents regression —
  // if you need storage access, route it through an exported helper.
  // Exception: src/utils/hallOfManagers.ts pre-dates the convention and
  // owns its own key namespace; split out in a follow-up.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/store/helpers/persistence.ts",
      "src/utils/hallOfManagers.ts",
      "src/test/**",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "localStorage",
          message: "Use src/store/helpers/persistence.ts (saveSlot/flag/session helpers) instead of direct localStorage access.",
        },
        {
          name: "sessionStorage",
          message: "Use readSessionJson / writeSessionJson / removeSessionKey from src/store/helpers/persistence.ts instead.",
        },
      ],
    },
  },
  // Community-pack data (byClub, freeAgents, newLeagues) is ~3.5 MB gzipped
  // and must only ship to users who opt in to the community pack at new-game
  // time. It is dynamic-imported from orchestrationSlice via `await import(...)`
  // guarded by `communityPackEnabled`. A static import anywhere else would
  // collapse the split and ship the whole pack to every user on boot.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/data/communityPack/**",
      "src/test/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/data/communityPack/byClub",
                "@/data/communityPack/freeAgents",
                "@/data/communityPack/newLeagues",
                "@/data/communityPack/cpLeagueSquads",
              ],
              message: "Community-pack data must be dynamic-imported via `await import('@/data/communityPack/...')` from inside initGame so it stays out of the eager bundle. See docs/bundle-report.md.",
            },
          ],
        },
      ],
    },
  },
);
