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
    '@typescript-eslint/no-unused-vars': 0, // Configured in tsconfig instead.
    semi: ['error', 'always'],
    'import/order': 'error',
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    'unused-imports/no-unused-imports': 'error',
    'no-console': 'off',
  },
};

export default [
  {
    ignores: ['main.js', 'docs/**/*'],
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
  eslintConfigPrettier,
];