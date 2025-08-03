/**
 * CM6 extension factory and state field for reminder pills
 */
import type { App } from "obsidian";
import type { Extension } from "@codemirror/state";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

import { type ReminderSpan, parseReminder } from "../../../model/format";
import { ensureReminderPillStylesInjected } from "./styles";
import type { PillContext } from "./types";
import { PillWidget, pillReplace, specFrom } from "./pill-widget";
import { buildMarkdownDocument, deriveSpans } from "./spans";
import { forceReminderPillRecompute } from "./state-effects";

const createReminderPillField = (app: App) =>
  StateField.define<DecorationSet>({
    create: (state) => {
      try {
        const content = state.doc?.toString?.() ?? "";
        const md = buildMarkdownDocument(app, content);

        const reminders: ReminderSpan[] = parseReminder(md);
        const spans = deriveSpans(md, reminders, state);

        const ctx: PillContext = { app };

        const builder = new RangeSetBuilder<Decoration>();
        const head =
          typeof state.selection?.main?.head === "number"
            ? state.selection.main.head
            : -1;

        let lastTo = -1;
        for (const s of spans) {
          // basic validation of span
          if (
            typeof s.from !== "number" ||
            typeof s.to !== "number" ||
            s.from > s.to
          ) {
            continue;
          }
          // skip if caret is inside span
          if (head >= s.from && head <= s.to) continue;

          // ensure non-decreasing add order (required by RangeSetBuilder)
          const from = Math.max(0, s.from);
          const to = Math.max(from, s.to);
          if (to < lastTo) {
            // out-of-order or invalid; skip to avoid throwing
            continue;
          }
          lastTo = to;

          builder.add(
            from,
            to,
            pillReplace(from, to, new PillWidget(specFrom(s), ctx)),
          );
        }
        return builder.finish();
      } catch {
        // On any unexpected failure, return no decorations
        return Decoration.none;
      }
    },

    update: (value, tr) => {
      try {
        const selectionChanged = !tr.startState.selection.eq(
          tr.state.selection,
        );
        if (
          tr.docChanged ||
          selectionChanged ||
          tr.effects.some((e) => e.is(forceReminderPillRecompute))
        ) {
          // TODO 毎回全文読み直すのを避ける
          // 現状だとキャレットが一つ動いたり変更したりする度に、全文を読み直している
          const content = tr.state.doc?.toString?.() ?? "";
          const md = buildMarkdownDocument(app, content);

          const reminders: ReminderSpan[] = parseReminder(md);
          const spans = deriveSpans(md, reminders, tr.state);

          const ctx: PillContext = { app };

          const builder = new RangeSetBuilder<Decoration>();
          const head =
            typeof tr.state.selection?.main?.head === "number"
              ? tr.state.selection.main.head
              : -1;

          let lastTo = -1;
          for (const s of spans) {
            if (
              typeof s.from !== "number" ||
              typeof s.to !== "number" ||
              s.from > s.to
            ) {
              continue;
            }
            if (head >= s.from && head <= s.to) continue;

            const from = Math.max(0, s.from);
            const to = Math.max(from, s.to);
            if (to < lastTo) {
              continue;
            }
            lastTo = to;

            builder.add(
              from,
              to,
              pillReplace(from, to, new PillWidget(specFrom(s), ctx)),
            );
          }
          return builder.finish();
        }
        return value;
      } catch {
        // Preserve previous decorations if update fails
        return value;
      }
    },

    provide: (f) => EditorView.decorations.from(f),
  });

export function createReminderPillExtension(app: App): Extension[] {
  ensureReminderPillStylesInjected();
  const reminderPillField = createReminderPillField(app);
  return [reminderPillField];
}
