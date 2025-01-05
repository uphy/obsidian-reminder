import prettierPlugin from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import typescriptEslintParser from '@typescript-eslint/parser';


/** @type {import("eslint").Linter.Config} */
const config = {
  files: ["src/**/*.ts"],
  /*
  env: {
    es6: true,
    node: true,
    browser: true,
  },
  */
  /*
   extends: [
     
     'eslint:recommended',
     'plugin:@typescript-eslint/eslint-recommended',
     'plugin:import/typescript',
   ],
       */
  languageOptions: {
    globals: {
      Atomics: 'readonly',
      SharedArrayBuffer: 'readonly',
    },
    parser: typescriptEslintParser,
    parserOptions: {
      ecmaVersion: 6,
      sourceType: 'module',
      ecmaFeatures: {
        modules: true,
      },
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
    'no-unused-vars': 0, // Configured in tsconfig instead.
    semi: ['error', 'always'],
    'import/order': 'error',
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
      },
    ],
    'unused-imports/no-unused-imports': 'error'
  },
};

export default [
  {
    ignores: ['main.js'],
  },
  config,
  eslintConfigPrettier,
];