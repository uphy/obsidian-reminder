# Coding style

Only documents conventions that can be read off from `eslint.config.js`, `tsconfig.json`, `.editorconfig`, and the actual code.

## Formatting

- Indent with 2 spaces (`.editorconfig`, consistent across `*.ts`/`*.svelte`/`*.json`/`*.md`).
- Line endings are always LF (`linebreak-style: unix`), files end with a trailing newline, and trailing whitespace is trimmed except in Markdown.
- Semicolons are required (`semi: always`).
- Use double quotes for strings consistently. eslint's `quotes` rule itself is set to `single`, but `eslint-config-prettier` disables it later in the chain, so prettier's default (double quotes) is effectively what's enforced. The existing code is also consistently double-quoted.
- Formatting is delegated to prettier for the most part (`prettier/prettier: error`). `.svelte` files are also formatted via `prettier-plugin-svelte` (parser specified through `prettier.overrides` in `package.json`).
- Format-on-save is assumed (`editor.formatOnSave: true` + `esbenp.prettier-vscode` in `.vscode/settings.json`).

## Imports

- The order of import statements is checked by the `import/order` rule (group ordering is enforced).
- The order of named imports within a single import statement is checked by `sort-imports` (`ignoreDeclarationSort: true`) — this doesn't enforce ordering between statements, but does enforce the ordering of names within one statement.
- Unused imports are an error via `unused-imports/no-unused-imports`. Unused variables themselves are left to tsconfig (equivalent to `noUnusedLocals`), and eslint's `@typescript-eslint/no-unused-vars` is explicitly turned off.
- Because `tsconfig.json`'s `baseUrl` is `./src/`, you can write absolute-path-style imports rooted at src, like `model/reminder` (not relative paths). Most files use this style, but some, like `src/plugin/ui/reminder.ts`, mix in relative paths (`../../model/reminder`) as well — prefer the src-rooted style for new code.
- Type-only imports are explicitly written as `import type { ... }` in most places (since `verbatimModuleSyntax: true` effectively requires `import type` for type-only imports).

## TypeScript

- Strict settings such as `strictNullChecks`, `strictPropertyInitialization`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, and `noImplicitOverride` are enabled. Be mindful in the type system of the possibility of `undefined` when accessing arrays and Maps (the existing code handles this in many places with the non-null assertion operator `!`).
- Add the `override` modifier to overridden class methods (see `onload`/`onunload` in `main.ts`).

## Svelte

- Use TS via `<script lang="typescript">` (e.g. `ui/Reminder.svelte`).
- Declare props with `export let xxx: Type;`, and pass callback-style props from the parent as function types (e.g. `export let onDone: () => void;`).
- Scope styles inside the component's `<style>` block, and use Obsidian's theme variables (`var(--text-muted)`, etc).
