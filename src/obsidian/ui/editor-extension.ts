import { EditorSelection } from '@codemirror/state';
import { ViewPlugin, ViewUpdate } from '@codemirror/view';
import type { Reminders } from 'model/reminder';
import type { App } from 'obsidian';
import { SETTINGS } from 'obsidian/settings';
import { showDateTimeChooserModal } from './date-chooser-modal';

export function buildCodeMirrorPlugin(app: App, reminders: Reminders) {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.docChanged) {
          return;
        }
        update.changes.iterChanges((_fromA, _toA, _fromB, toB, inserted) => {
          const doc = update.state.doc;
          const text = doc.sliceString(toB - 2, toB);
          if (inserted.length === 0) {
            return;
          }
          const trigger = SETTINGS.autoCompleteTrigger.value;
          const timeStep = SETTINGS.reminderTimeStep.value;
          if (trigger === text) {
            showDateTimeChooserModal(app, reminders, timeStep)
              .then((value) => {
                const format = SETTINGS.primaryFormat.value.format;
                try {
                  const line = doc.lineAt(toB);

                  // remove trigger character from the line
                  const triggerStart = line.text.lastIndexOf(trigger);
                  let triggerEnd = triggerStart + trigger.length;
                  if (trigger.startsWith('(') && line.text.charAt(triggerEnd) === ')') {
                    // Obsidian complement `)` when user input `(`.
                    // To remove the end of the brace, adjust the trigger end index.
                    triggerEnd++;
                  }
                  const triggerExcludedLine = line.text.substring(0, triggerStart) + line.text.substring(triggerEnd);

                  // insert/update a reminder of the line
                  const reminderInsertion = format.appendReminder(triggerExcludedLine, value, triggerStart);
                  if (reminderInsertion == null) {
                    console.error('Cannot append reminder time to the line: line=%s, date=%s', line.text, value);
                    return;
                  }

                  // overwrite the line
                  const updateTextTransaction = update.view.state.update({
                    changes: { from: line.from, to: line.to, insert: reminderInsertion.insertedLine },
                    // Move the cursor to the last of date string to make it easy to input time part.
                    selection: EditorSelection.cursor(line.from + reminderInsertion.caretPosition),
                  });
                  update.view.update([updateTextTransaction]);
                } catch (ex) {
                  console.error(ex);
                }
              })
              .catch(() => {
                /* do nothing on cancel */
              });
          }
        });
      }
    },
  );
}
