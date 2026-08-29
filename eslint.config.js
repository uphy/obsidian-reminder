import prettierPlugin from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import-x';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import typescriptEslintParser from '@typescript-eslint/parser';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import obsidianmd from 'eslint-plugin-obsidianmd';
import svelteParser from 'svelte-eslint-parser';
import js from "@eslint/js";
import globals from "globals"

/** @type {import("eslint").Linter.Config} */
const config = {
  files: ["src/**/*.ts", "src/**/*.svelte"],
  languageOptions: {
    globals: {
      CodeMirror: 'readonly',
      ...globals.browser,
      ...globals.node,
      ...globals.es2020,
      ...globals.jest,
    },
    parser: typescriptEslintParser,
    parserOptions: {
      ecmaVersion: 6,
      sourceType: 'module',
      ecmaFeatures: {
        modules: true,
      },
      extraFileExtensions: ['.svelte'],
    },
  },
  plugins: {
    '@typescript-eslint': typescriptEslintPlugin,
    'import-x': importPlugin,
    'unused-imports': unusedImportsPlugin,
    prettier: prettierPlugin,
  },
  rules: {
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    'import-x/order': 'error',
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    'unused-imports/no-unused-imports': 'error',
    'prettier/prettier': 'error',
  },
};

/**
 * Unused-vars handling, placed after js.configs.recommended in the array below so
 * it can override the base `no-unused-vars` rule that recommended re-enables.
 */
/** @type {import("eslint").Linter.Config} */
const unusedVarsConfig = {
  files: ["src/**/*.ts", "src/**/*.svelte"],
  rules: {
    'no-unused-vars': 'off', // Replaced by @typescript-eslint/no-unused-vars.
    '@typescript-eslint/no-unused-vars': 'error',
  },
};

/**
 * Rules this project sets that obsidianmd's recommended config turns off, so
 * they live here rather than in `config` above -- placed after that config in
 * the array below to win. Verify with:
 *
 *   npx eslint --print-config src/main.ts
 *
 * A severity of 0 for any of these means obsidianmd took the rule over again.
 */
/** @type {import("eslint").Linter.Config} */
const projectRuleOverrides = {
  files: ["src/**/*.ts", "src/**/*.svelte"],
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../*'],
            message:
              'Use src-rooted import paths (e.g. "model/reminder") instead of parent-relative paths.',
          },
        ],
      },
    ],
  },
};

/**
 * This file reassigns the global console methods on purpose to redirect mobile
 * debug output to a log file. Scoping the exemption here instead of using an
 * inline `eslint-disable` comment keeps `eslint-comments/no-restricted-disable`
 * satisfied -- the Obsidian directory scan rejects disabling `no-console` by
 * directive comment.
 */
/** @type {import("eslint").Linter.Config} */
const debugMobileConfig = {
  files: ['src/plugin/obsidian-hack/obsidian-debug-mobile.ts'],
  rules: {
    'no-console': 'off',
    // obsidianmd re-reports no-console through its own rule, which the
    // exemption above does not reach. The findings here are the assignments
    // that install the patch, not logging calls.
    'obsidianmd/rule-custom-message': 'off',
  },
};

/**
 * Ratchet for the Obsidian directory scan rules that the codebase does not
 * satisfy yet. Every rule here is downgraded to a warning so `npm run lint`
 * stays green while they are worked through one at a time.
 *
 * Delete an entry once its findings are fixed -- never add one back. The counts
 * are the findings as of the day this ratchet was introduced; they are a rough
 * size estimate, not something to keep in sync.
 */
/** @type {import("eslint").Linter.Config[]} */
const scanRatchet = [{
  // .ts only: the type-aware rules below need projectService, which
  // typeAwareConfig sets for TS files and cannot set for .svelte files.
  files: ["src/**/*.ts"],
  rules: {
    // Inline styles that belong in styles.css or setCssStyles.
    'obsidianmd/no-static-styles-assignment': 'warn', // 30
    // All four fall out of the same `any` values, largely in obsidian-hack/
    // (private Obsidian APIs) and the Electron notification code.
    '@typescript-eslint/no-unsafe-member-access': 'warn', // 19
    '@typescript-eslint/no-unsafe-assignment': 'warn', // 18
    '@typescript-eslint/no-unsafe-call': 'warn', // 6
    '@typescript-eslint/no-unsafe-return': 'warn', // 3
    // `throw "string"` instead of `throw new Error(...)`.
    '@typescript-eslint/only-throw-error': 'warn', // 11
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn', // 4
    '@typescript-eslint/no-for-in-array': 'warn', // 1
    '@typescript-eslint/restrict-plus-operands': 'warn', // 1
    '@typescript-eslint/prefer-promise-reject-errors': 'warn', // 1
  },
}, {
  files: ['package.json'],
  rules: {
    // Deprecated/replaceable packages in devDependencies.
    'depend/ban-dependencies': 'warn', // 2
  },
}];

/**
 * The build and release scripts run under Node, never inside Obsidian, so the
 * mobile-safety rule against Node built-ins does not apply to them.
 */
/** @type {import("eslint").Linter.Config} */
const nodeScriptsConfig = {
  files: ['esbuild.config.mjs', 'scripts/**/*.mjs'],
  rules: {
    'obsidianmd/no-nodejs-modules': 'off',
  },
};

/** Type-aware rules: TS files only (projectService can't include .svelte files). */
/** @type {import("eslint").Linter.Config} */
const typeAwareConfig = {
  files: ["src/**/*.ts"],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
  },
};

export default [
  {
    ignores: ['main.js', 'docs/**/*', '.claude/**/*'],
  },
  config,
  js.configs.recommended,
  // Some entries of svelte's recommended config carry no `files`, so they apply
  // to every linted file. That is harmless on its own, but the obsidianmd config
  // below adds package.json to the lint targets, and svelte's rules crash on a
  // file the svelte parser never saw. Scope them to .svelte files.
  ...eslintPluginSvelte.configs['flat/recommended'].map((c) =>
    c.files ? c : { ...c, files: ['**/*.svelte'] },
  ),
  {
    files: ["src/**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: typescriptEslintParser,
      }
    },
  },
  // The rule set the Obsidian community directory runs its automated release
  // scan with. Keeping it here means a scan failure shows up in `npm run lint`
  // instead of only on the plugin's directory dashboard after a release.
  ...obsidianmd.configs.recommended,
  projectRuleOverrides,
  debugMobileConfig,
  unusedVarsConfig,
  typeAwareConfig,
  nodeScriptsConfig,
  ...scanRatchet,
  eslintConfigPrettier,
];