# Testing

`jest` (ts-jest, ESM preset) + `jsdom` environment. Configuration is written directly under the `jest` key in `package.json` (there is no `jest.config.*` file).

## Running tests

```
npm run test          # Full suite (= mise run main:test)
npx jest path/to/x.test.ts   # Run a single file
npx jest -t "part of a test name"  # Filter by name
```

## Placement and coverage

- Test files live in the same directory as what they test, named `*.test.ts` (e.g. `src/model/format/reminder-default.ts` → `reminder-default.test.ts`). `testMatch: ["**/*.test.ts"]`.
- Tests actually exist only for `src/model/` and `src/ui/calendar.ts` (mostly `src/model/format/*.test.ts`). There are no tests for anything under `src/plugin/` or for `.svelte` components — this follows from the `model/` layer being designed with no dependency on the Obsidian API. When writing new domain logic in `model/`, keep it testable the same way (don't import the `obsidian` package).
- There's no mock for the `obsidian` package. Don't unit-test code that imports `obsidian` (or extract the dependency out into `model/`).

## Example patterns

`describe`/`test` are consistently written as arrow functions with `(): void =>` (see `src/model/format/splitter.test.ts`, etc).

```ts
describe("Symbol", (): void => {
  test("ofChar()", (): void => {
    const s = Symbol.ofChar("🔁");
    expect(s.isSymbol("🔁")).toBe(true);
  });
});
```

The parse/modify tests for each format under `model/format/` reuse the shared helper `ReminderFormatTestUtil` (`src/model/format/reminder-base.test.ts`). When adding a new reminder format parser, use this utility's `testParse`/`testModify`.

```ts
const util = new ReminderFormatTestUtil(() => new DefaultReminderFormat());
util.testParse({
  inputMarkdown: "- [ ] Task1 (@2021-09-14)",
  expectedTime: "2021-09-14",
  expectedTitle: "Task1",
});
```

## ESM notes

- `package.json` has `"type": "module"`, and jest runs with `preset: "ts-jest/presets/default-esm"` + `useESM: true`. Even so, relative imports and src-rooted imports (`moduleDirectories: ["node_modules", "src"]`) don't need a `.js` extension (existing tests import without an extension too).
- `moduleFileExtensions` is only `["js", "ts"]`. There's no transform registered for `.svelte` (`svelte-jester` is listed as a dependency but isn't registered in jest's `transform` config), so you can't write tests that import a `.svelte` file directly. Verify Svelte components manually through the UI, or move the logic into TS (e.g. `ui/calendar.ts`) so it can be tested.
