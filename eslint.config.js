import prettierPlugin from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import typescriptEslintParser from '@typescript-eslint/parser';
import eslintPluginSvelte from 'eslint-plugin-svelte';
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
    import: importPlugin,
    'unused-imports': unusedImportsPlugin,
    prettier: prettierPlugin,
  },
  rules: {
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    'import/order': 'error',
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    'unused-imports/no-unused-imports': 'error',
    'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
    'no-restricted-imports': ['error', { patterns: [{ group: ['../*'], message: 'Use src-rooted import paths (e.g. "model/reminder") instead of parent-relative paths.' }] }],
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
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    files: ["src/**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: typescriptEslintParser,
      }
    },
  },
  unusedVarsConfig,
  typeAwareConfig,
  eslintConfigPrettier,
];