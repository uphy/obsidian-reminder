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
- Most tests cover `src/model/` (mostly `src/model/format/*.test.ts`) and `src/ui/calendar.ts`, which is where domain logic belongs: that layer has no dependency on the Obsidian API, so it's testable with nothing else in place. When writing new domain logic in `model/`, keep it that way (don't import the `obsidian` package).
- Parts of `src/plugin/` are tested too — `data.test.ts`, `notification-worker.test.ts`, `ntfy.test.ts`. There are no tests for `.svelte` components.
- The `obsidian` npm package ships only type definitions (`"main": ""`), so a file importing it can't be loaded by jest as-is. `moduleNameMapper` in `package.json` maps `^obsidian$` to `src/test/obsidian-mock.ts`, which exists to make the module graph load: empty classes, and functions that throw if actually called. Add an export there when a new import path reaches it.
- Don't give the mock real behavior to test against. Anything a test needs to drive — HTTP, notifications, timers, persistence — is injected through a deps interface instead (`NotificationWorkerDeps`, `NtfyControllerDeps`, `DataStore`), and the test passes a fake. That's what makes a `plugin/` class testable, and it keeps the mock from turning into shared mutable state between test files.

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
