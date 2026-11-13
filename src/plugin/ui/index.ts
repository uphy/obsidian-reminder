import { onLanguageChange, tn } from "i18n";
import type ReminderPlugin from "main";
import type { ReadOnlyReference } from "model/ref";
import type { Reminder } from "model/reminder";
import type { DateTime } from "model/time";
import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Platform,
  PluginSettingTab,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { refreshCommandNames, registerCommands } from "plugin/commands";
import { showPauseDurationChooser } from "plugin/core/dnd";
import { rebuildMarkdownViews } from "plugin/obsidian-hack/leaf";
import { monkeyPatchConsole } from "plugin/obsidian-hack/obsidian-debug-mobile";
import { VIEW_TYPE_REMINDER_LIST } from "./constants";
import { DndStatusBar } from "./status-bar/dnd-status-bar";
import { findLeafShowingFile } from "./find-leaf-showing-file";
import { OverdueStatusBar } from "./status-bar/overdue-status-bar";
import { ReminderListItemViewProxy } from "./views/reminder-list";
import { AutoComplete } from "./editor/autocomplete";
import type { AutoCompletableEditor } from "./editor/autocomplete";
import { buildCodeMirrorPlugin } from "./editor/editor-extension";
import {
  createReminderPillExtension,
  createRenderedBlockPillPostProcessor,
} from "./editor/editor-reminder-display";
import {
  createReminderLineHighlightExtension,
  highlightReminderLine,
} from "./editor/reminder-line-highlight";
import type { ReminderActions } from "./notifications/reminder-actions";
import { ReminderNotifier } from "./notifications/reminder-notifier";

export class ReminderPluginUI {
  private autoComplete: AutoComplete;
  private editDetector: EditDetector;
  private reminderNotifier: ReminderNotifier;
  private viewProxy: ReminderListItemViewProxy;
  private dndStatusBar: DndStatusBar;
  private overdueStatusBar: OverdueStatusBar;
  // Kept so a language change can re-render the open settings tab.
  private settingTab?: ReminderSettingTab;
  constructor(private plugin: ReminderPlugin) {
    this.viewProxy = new ReminderListItemViewProxy(
      this.plugin,
      // On select a reminder in the list
      (reminder) => {
        if (
          !this.plugin.settings.notifications.openNoteOnReminderClick.value &&
          reminder.muteNotification
        ) {
          this.showReminder(reminder);
          return;
        }
        // Callback is synchronous; opening the file is fire-and-forget here.
        this.handleReminderAction(reminder, "open");
      },
    );
    this.autoComplete = new AutoComplete(
      plugin.settings.editor.autoCompleteTrigger,
      plugin.settings.notifications.reminderTimeStep,
      plugin.settings.editor.primaryFormat,
      plugin.settings.editor.convertNonTaskLines,
      plugin.settings.weekStart,
    );
    this.editDetector = new EditDetector(plugin.settings.editDetectionSec);
    this.reminderNotifier = new ReminderNotifier(
      plugin.app,
      plugin.settings.notifications.useSystemNotification,
      plugin.settings.notifications.laters,
      plugin.settings.notifications.openNoteOnReminderClick,
      plugin.settings.notifications.showPopupWithSystemNotification,
      plugin.settings.notifications.keepSystemNotificationOnScreen,
      plugin.settings.notifications.focusDoneButtonOnPopup,
      plugin.settings.notifications.notificationPopupStyle,
    );
    this.dndStatusBar = new DndStatusBar(plugin);
    this.overdueStatusBar = new OverdueStatusBar(plugin);
  }

  onload() {
    this.dndStatusBar.onload();
    this.overdueStatusBar.onload();

    // Reminder List
    this.plugin.registerView(VIEW_TYPE_REMINDER_LIST, (leaf: WorkspaceLeaf) => {
      return this.viewProxy.createView(leaf);
    });
    this.plugin.addSettingTab(
      (this.settingTab = new ReminderSettingTab(this.plugin.app, this.plugin)),
    );
    // Every label this plugin renders is translated when it is rendered, so a
    // language change has to re-render the surfaces that are already on
    // screen. Open popups/modals are short-lived and pick the new language up
    // the next time they open.
    this.plugin.register(
      onLanguageChange(() => {
        this.onLanguageChanged();
      }),
    );

    this.plugin.registerDomEvent(document, "keydown", () => {
      this.editDetector.fileChanged();
    });
    if (Platform.isDesktopApp) {
      this.plugin.registerEditorExtension(
        buildCodeMirrorPlugin(
          this.plugin.app,
          this.plugin.reminders,
          this.plugin.settings,
        ),
      );
      this.plugin.registerEditorExtension(
        createReminderPillExtension(this.plugin),
      );
      this.plugin.registerEditorExtension(
        createReminderLineHighlightExtension(),
      );
      // Live Preview replaces callouts (and other rendered blocks) with a
      // block widget, which discards the editor extension's decorations
      // inside them. Those widgets render through the markdown
      // post-processor pipeline instead, so the pills have to be built
      // there as well (#359).
      this.plugin.registerMarkdownPostProcessor(
        createRenderedBlockPillPostProcessor(this.plugin),
      );
      // Reconfiguring editor extensions is how CM6 signals every open
      // editor's `StateField` that something changed (`tr.reconfigured`),
      // which is what lets the pill extension re-check the toggle
      // immediately instead of only on the editor's next edit/selection
      // change.
      // The post-processor's pills live in widgets Obsidian owns, which keep
      // their DOM until the view is recreated — `updateOptions()` alone would
      // leave callouts showing the old state until the note is reopened.
      this.plugin.settings.editorReminderDisplay.rawValue.onChanged(() => {
        this.plugin.app.workspace.updateOptions();
        rebuildMarkdownViews(this.plugin.app);
      });
    }

    registerCommands(this.plugin);
  }

  onLayoutReady() {
    if (this.plugin.data.debug.value) {
      monkeyPatchConsole(this.plugin);
    }

    // Open reminder list view. This callback will fire immediately if the
    // layout is ready, and will otherwise be enqueued.
    this.viewProxy.openView();
  }

  onunload() {
    this.detachReminderList();
    this.reminderNotifier.destroy();
  }

  isEditing(): boolean {
    return this.editDetector.isEditing();
  }

  /**
   * Re-renders everything that is already on screen in the language that was
   * just selected: command names, the settings tab (if open), the status bar
   * items, and the reminder list.
   */
  private onLanguageChanged(): void {
    refreshCommandNames(this.plugin);
    if (this.settingTab?.containerEl.isConnected) {
      // Deferred: this runs from inside the language dropdown's own change
      // handler, and re-rendering the tab synchronously would tear down the
      // element that is still dispatching the event.
      //
      // `display()` is avoided (deprecated since 1.13); re-rendering the
      // plugin's own tab model is exactly what it did.
      window.setTimeout(() => {
        if (this.settingTab?.containerEl.isConnected) {
          this.plugin.settings.settings.displayOn(this.settingTab.containerEl);
        }
      }, 0);
    }
    this.overdueStatusBar.refresh();
    this.dndStatusBar.refresh();
    if (Platform.isDesktopApp) {
      // The pills are editor widgets whose `eq()` compares only what is
      // rendered, and the ones inside callouts live in Obsidian-owned
      // widgets. Reconfiguring the editor extensions re-runs their `eq()`
      // (picking up the new tooltip text) and rebuilding the markdown views
      // refreshes the post-processor output, without either of them waiting
      // for the note to be edited or reopened.
      this.plugin.app.workspace.updateOptions();
      rebuildMarkdownViews(this.plugin.app);
    }
    this.viewProxy.invalidate();
    this.viewProxy.reload(true);
  }

  invalidate() {
    this.viewProxy.invalidate();
    this.overdueStatusBar.refresh();
    this.reminderNotifier.sync(
      new Set(
        this.plugin.reminders.reminders.map((reminder) => reminder.key()),
      ),
    );
  }

  reload(force: boolean = false) {
    this.viewProxy.reload(force);
    this.overdueStatusBar.refresh();
  }

  showAutoComplete(editor: AutoCompletableEditor) {
    this.autoComplete.show(this.plugin.app, editor, this.plugin.reminders);
  }

  refreshDndStatusBar() {
    this.dndStatusBar.refresh();
  }

  async showReminderList() {
    const workspace = this.plugin.app.workspace;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST)[0];
    if (leaf == null) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf == null) {
        return;
      }
      await rightLeaf.setViewState({
        type: VIEW_TYPE_REMINDER_LIST,
      });
      leaf = rightLeaf;
    }
    // Without revealing the leaf, the view stays hidden when the right
    // sidebar is collapsed or another view is on top of it.
    await workspace.revealLeaf(leaf);
  }

  private detachReminderList() {
    this.plugin.app.workspace
      .getLeavesOfType(VIEW_TYPE_REMINDER_LIST)
      .forEach((leaf) => leaf.detach());
  }

  private async openReminderFile(reminder: Reminder) {
    const workspace = this.plugin.app.workspace;

    console.debug("Open reminder: ", reminder);
    const file = this.plugin.app.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("Cannot open file because it isn't a TFile: %o", file);
      return;
    }

    // Reuse a tab already showing the file. `getLeaf(false)` alone opens a
    // new tab whenever the current one is pinned, even if that pinned tab
    // shows this very file (#383). The path is read from the view state
    // rather than `leaf.view` so deferred (not yet loaded) tabs match too.
    let leaf = findLeafShowingFile(
      file.path,
      workspace.getMostRecentLeaf(),
      workspace.getLeavesOfType("markdown"),
      (l) => {
        const path = l.getViewState().state?.["file"];
        return typeof path === "string" ? path : undefined;
      },
    );
    if (leaf != null) {
      await workspace.revealLeaf(leaf);
      workspace.setActiveLeaf(leaf, { focus: true });
    } else {
      // Open the reminder file and jump to the reminder's line.
      leaf = workspace.getLeaf(false);
      await leaf.openFile(file);
    }
    if (!(leaf.view instanceof MarkdownView)) {
      return;
    }
    if (reminder.source === "tasknotes") {
      return;
    }
    const editor = leaf.view.editor;
    // A reused tab that was deferred (not yet loaded) gets its content a
    // moment after `revealLeaf` resolves; until then the editor is empty.
    if (!(await waitForLine(editor, reminder.rowNumber))) {
      console.warn("Reminder line is not in the editor: %o", reminder);
      return;
    }
    const line = editor.getLine(reminder.rowNumber);
    // Place the cursor on the line (no selection held) and scroll it into
    // view, matching Obsidian's own search-result jump behavior rather than
    // leaving the whole line selected (which risked the user accidentally
    // overwriting it while typing).
    editor.setCursor({ line: reminder.rowNumber, ch: 0 });
    editor.scrollIntoView(
      {
        from: { line: reminder.rowNumber, ch: 0 },
        to: { line: reminder.rowNumber, ch: line.length },
      },
      true,
    );

    // Highlight the line via the CM6 extension registered in `onload()`.
    // `.cm` is declared in `global.d.ts`: not part of Obsidian's public
    // `Editor` type, and only present on desktop, so this is a silent no-op
    // otherwise.
    const cm = editor.cm;
    if (cm) {
      const cmLine = cm.state.doc.line(reminder.rowNumber + 1);
      cm.dispatch({
        effects: highlightReminderLine.of({
          from: cmLine.from,
          to: cmLine.to,
        }),
      });
    }
  }

  showReminder(reminder: Reminder) {
    reminder.muteNotification = true;
    const actions: ReminderActions = {
      remindMeLater: (time) => {
        console.debug("Remind me later: time=%o", time);
        this.handleReminderAction(reminder, "snooze", time);
      },
      done: () => {
        this.handleReminderAction(reminder, "done");
      },
      mute: () => {
        this.handleReminderAction(reminder, "mute");
      },
      openFile: () => {
        this.handleReminderAction(reminder, "open");
      },
      pauseAll: () => {
        console.debug("Pause all notifications");
        // Unlike Mute, this must not leave this specific reminder muted:
        // pausing suppresses notifications globally without touching
        // individual reminders, so it re-fires once the pause ends.
        //
        // However, we must NOT clear the mute flag right here. The duration
        // chooser (`showPauseDurationChooser`) is opened but DND isn't set
        // yet -- that only happens once the user actually picks a duration
        // (see `pauseNotifications()` in `plugin/dnd.ts`). If we cleared
        // `muteNotification` immediately, this reminder would be
        // unprotected for however long the chooser stays open: the next
        // `NotificationWorker` tick (every `reminderCheckIntervalSec`,
        // default 5s) would see an expired, unmuted reminder with no DND in
        // effect and pop the same reminder's modal again right on top of
        // the still-open chooser. So keep `muteNotification` at the `true`
        // it was set to when this reminder was displayed (top of
        // `showReminder()`), and only flip it back to `false` in the
        // chooser's `onClose` callback below, once the chooser is gone --
        // by then either DND is active (chooser closed via a selected
        // duration) or the user cancelled and expects normal re-notification
        // on the next tick. Do not "simplify" this back to an immediate
        // `reminder.muteNotification = false` without re-reading this
        // comment; that is the exact regression this code fixes.
        showPauseDurationChooser(this.plugin, () => {
          reminder.muteNotification = false;
        });
      },
      muteAll: () => {
        const count = this.muteExpiredReminders(reminder) + 1;
        new Notice(
          tn(count, "Muted {count} reminder", "Muted {count} reminders"),
        );
      },
    };
    this.reminderNotifier.show(reminder, actions);
  }

  muteExpiredReminders(currentReminder?: Reminder): number {
    const expired = this.plugin.reminders.getExpiredReminders(
      this.plugin.settings.notifications.reminderTime.value,
    );
    const newlyMuted = expired.filter((reminder) => !reminder.muteNotification);
    newlyMuted.forEach((reminder) => {
      this.handleReminderAction(reminder, "mute", undefined, false);
    });
    if (currentReminder) {
      this.handleReminderAction(currentReminder, "mute", undefined, false);
    }
    if (newlyMuted.length > 0 || currentReminder) {
      this.reload(true);
      void this.plugin.data.save(true);
    }
    return newlyMuted.length;
  }

  private handleReminderAction(
    reminder: Reminder,
    action: "done" | "snooze" | "mute" | "open",
    time?: DateTime,
    refresh: boolean = true,
  ): void {
    if (action === "open") {
      console.debug("Open");
      void this.openReminderFile(reminder);
      return;
    }
    if (action === "snooze") {
      if (!time) {
        throw new Error("A snooze time is required.");
      }
      console.debug("Remind me later: time=%o", time);
      if (reminder.source === "tasknotes") {
        this.plugin.taskNotes.snooze(reminder, time);
      } else {
        reminder.time = time;
        reminder.effectiveTime = time;
        reminder.muteNotification = false;
        void this.plugin.fileSystem.updateReminder(reminder, false);
      }
      void this.plugin.data.save(true);
      return;
    }
    if (action === "done") {
      console.debug("Done");
      if (reminder.source === "tasknotes") {
        void this.plugin.taskNotes
          .done(reminder)
          .then(() => {
            this.plugin.reminders.removeReminder(reminder);
            void this.plugin.data.save(true);
          })
          .catch((error: unknown) => {
            console.error("Failed to complete TaskNotes reminder: %o", error);
            new Notice(
              "Could not complete the tasknotes reminder. See the console for details.",
            );
          });
        return;
      } else {
        reminder.muteNotification = false;
        void this.plugin.fileSystem.updateReminder(reminder, true);
      }
      this.plugin.reminders.removeReminder(reminder);
      void this.plugin.data.save(true);
      return;
    }
    console.debug("Mute");
    if (reminder.source === "tasknotes") {
      this.plugin.taskNotes.mute(reminder);
    } else {
      reminder.muteNotification = true;
    }
    if (refresh) {
      this.reload(true);
      void this.plugin.data.save(true);
    }
  }
}

class EditDetector {
  private lastModified?: Date;

  constructor(private editDetectionSec: ReadOnlyReference<number>) {}

  fileChanged() {
    this.lastModified = new Date();
  }

  isEditing(): boolean {
    if (this.editDetectionSec.value <= 0) {
      return false;
    }
    if (this.lastModified == null) {
      return false;
    }
    const elapsedSec =
      (new Date().getTime() - this.lastModified.getTime()) / 1000;
    return elapsedSec < this.editDetectionSec.value;
  }
}

export class ReminderSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ReminderPlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;

    this.plugin.settings.settings.displayOn(containerEl);
  }
}

/**
 * Wait (up to `timeoutMs`) until the editor has a line `row`. Returns whether
 * it does.
 */
async function waitForLine(
  editor: Editor,
  row: number,
  timeoutMs = 2000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (editor.lineCount() <= row) {
    if (Date.now() > deadline) {
      return false;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return true;
}
