/**
 * CM6 extension factory and state field for reminder pills
 */
import type { App } from "obsidian";
import type { Extension } from "@codemirror/state";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

import { ensureReminderPillStylesInjected } from "./styles";
import type { PillContext } from "./types";
import { specFrom, PillWidget, pillReplace } from "./pill-widget";
import { buildMarkdownDocument, deriveSpans } from "./spans";
import { forceReminderPillRecompute } from "./state-effects";
import { parseReminder, type ReminderSpan } from "../../../model/format";

// Feature flag: Live Preview pill decorations enabled
const PILL_DECORATIONS_ENABLED = true as const;

const createReminderPillField = (app: App) =>
  StateField.define<DecorationSet>({
    create: (state) => {
      const content = state.doc.toString();
      const md = buildMarkdownDocument(app, content);
      let reminders: ReminderSpan[] = [];
      try {
        reminders = parseReminder(md);
      } catch {
        reminders = [];
      }
      const spans = deriveSpans(md, reminders, state);
      const ctx: PillContext = { app };

      if (!PILL_DECORATIONS_ENABLED) return Decoration.none;
      const builder = new RangeSetBuilder<Decoration>();
      const head = state.selection.main.head;
      for (const s of spans) {
        if (head >= s.from && head <= s.to) continue;
        try {
          builder.add(
            s.from,
            s.to,
            pillReplace(s.from, s.to, new PillWidget(specFrom(s), ctx)),
          );
        } catch {
          // ignore
        }
      }
      return builder.finish();
    },

    update: (value, tr) => {
      const selectionChanged = !tr.startState.selection.eq(tr.state.selection);
      if (
        tr.docChanged ||
        selectionChanged ||
        tr.effects.some((e) => e.is(forceReminderPillRecompute))
      ) {
        const content = tr.state.doc.toString();
        const md = buildMarkdownDocument(app, content);
        let reminders: ReminderSpan[] = [];
        try {
          reminders = parseReminder(md);
        } catch {
          reminders = [];
        }
        const spans = deriveSpans(md, reminders, tr.state);
        const ctx: PillContext = { app };

        if (!PILL_DECORATIONS_ENABLED) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        const head = tr.state.selection.main.head;
        for (const s of spans) {
          if (head >= s.from && head <= s.to) continue;
          try {
            builder.add(
              s.from,
              s.to,
              pillReplace(s.from, s.to, new PillWidget(specFrom(s), ctx)),
            );
          } catch {
            // ignore
          }
        }
        return builder.finish();
      }
      return value;
    },

    provide: (f) => EditorView.decorations.from(f),
  });

export function createReminderPillExtension(app: App): Extension[] {
  ensureReminderPillStylesInjected();
  const reminderPillField = createReminderPillField(app);
  return [reminderPillField];
}
