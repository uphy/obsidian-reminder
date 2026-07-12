import type { EditorView } from "@codemirror/view";
import type { ReadOnlyReference } from "model/ref";
import type { Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import { App, Platform } from "obsidian";
import type { EditorPosition } from "obsidian";
import type { ReminderFormatType } from "model/format";
// obsidian's own type definitions dropped their (unused) re-export of the
// legacy CodeMirror 5 types in 1.13, so import them directly here for
// `isTrigger()`'s CM5-era change-detection signature below.
import type * as CodeMirror from "codemirror";
import { CM6DateTimeChooserPopup } from "./cm6-datetime-chooser";
import { showDateTimeChooserModal } from "./date-chooser-modal";
import {
  appendReminderOrConvert,
  showReminderInsertionFailureNotice,
} from "./util";

export interface AutoCompletableEditor {
  getCursor(): EditorPosition;

  getLine(line: number): string;

  replaceRange(
    replacement: string,
    from: EditorPosition,
    to?: EditorPosition,
    origin?: string,
  ): void;
}

export class AutoComplete {
  constructor(
    private trigger: ReadOnlyReference<string>,
    private timeStep: ReadOnlyReference<number>,
    private primaryFormat: ReadOnlyReference<ReminderFormatType>,
    private convertNonTaskLines: ReadOnlyReference<boolean>,
    private weekStart: ReadOnlyReference<string>,
  ) {}

  isTrigger(cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) {
    const trigger = this.trigger.value;
    if (trigger.length === 0) {
      return false;
    }
    if (changeObj.text.contains(trigger.charAt(trigger.length - 1))) {
      const line =
        cmEditor.getLine(changeObj.from.line).substring(0, changeObj.to.ch) +
        changeObj.text;
      if (!line.match(/^\s*- \[.\]\s.*/)) {
        // is not a TODO line
        return false;
      }
      if (line.endsWith(trigger)) {
        return true;
      }
    }
    return false;
  }

  show(app: App, editor: AutoCompletableEditor, reminders: Reminders): void {
    let result: Promise<DateTime>;
    if (Platform.isDesktopApp) {
      // `.cm` is not part of Obsidian's public `Editor` type (see
      // `openReminderFile()` in `plugin/ui/index.ts` for the same cast),
      // but it's how the CM6 `EditorView` backing the active editor is
      // reached from here.
      const view: EditorView | undefined = (editor as any).cm;
      if (view == null) {
        console.error("Cannot get CodeMirror 6 editor view.");
        result = showDateTimeChooserModal(
          app,
          reminders,
          this.timeStep.value,
          Number(this.weekStart.value),
        );
      } else {
        const pos = view.state.selection.main.head;
        const popup = new CM6DateTimeChooserPopup(
          view,
          reminders,
          this.timeStep.value,
          Number(this.weekStart.value),
        );
        result = popup.show(pos);
      }
    } else {
      result = showDateTimeChooserModal(
        app,
        reminders,
        this.timeStep.value,
        Number(this.weekStart.value),
      );
    }

    result
      .then((value) => {
        this.insert(editor, value, true);
      })
      .catch(() => {
        /* do nothing on cancel */
      });
  }

  insert(
    editor: AutoCompletableEditor,
    value: DateTime,
    triggerFromCommand: boolean = false,
  ): void {
    const pos = editor.getCursor();
    let line = editor.getLine(pos.line);
    const endPos = {
      line: pos.line,
      ch: line.length,
    };

    // remove trigger string
    if (!triggerFromCommand) {
      line = line.substring(0, pos.ch - this.trigger.value.length);
    }
    // append reminder to the line
    const format = this.primaryFormat.value.format;
    try {
      const appended = appendReminderOrConvert(
        format,
        line,
        value,
        undefined,
        this.convertNonTaskLines.value,
      )?.insertedLine;
      if (appended == null) {
        showReminderInsertionFailureNotice();
        console.error(
          "Cannot append reminder time to the line: line=%s, date=%s",
          line,
          value,
        );
        return;
      }
      editor.replaceRange(appended, { line: pos.line, ch: 0 }, endPos);
    } catch (ex) {
      console.error(ex);
    }
  }
}
