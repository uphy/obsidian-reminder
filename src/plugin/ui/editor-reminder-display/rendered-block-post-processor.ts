import type ReminderPlugin from "main";
import { Content } from "model/content";
import type { Reminder } from "model/reminder";
import type {
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
} from "obsidian";
import { MarkdownRenderChild, Notice, TFile } from "obsidian";
import { showDateTimeChooserModal } from "plugin/ui/date-chooser-modal";
import ReminderPillComponent from "./ReminderPill.svelte";
import {
  decorateRenderedTaskItem,
  resolveRenderedReminder,
} from "./rendered-pill";

/**
 * Marks the container Obsidian wraps around a block it renders inside Live
 * Preview (a callout, a table, …) instead of leaving it as editable source.
 */
const RENDERED_BLOCK_SELECTOR = ".cm-embed-block";

/** Keeps the pill's Svelte component alive exactly as long as the rendered block. */
class ReminderPillRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly component: ReminderPillComponent,
  ) {
    super(containerEl);
  }

  override onunload(): void {
    this.component.$destroy();
  }
}

/**
 * Renders reminder pills inside the blocks that Live Preview renders as HTML
 * rather than as editable text.
 *
 * Obsidian replaces such a block (a callout, most visibly) with a single
 * block widget covering the whole range, and CodeMirror drops every
 * decoration inside a replaced range — so the pill decorations built by
 * `createReminderPillExtension()` never reach the screen there, and the
 * reminder shows up as raw text (#359).  Those blocks are rendered through
 * the markdown post-processor pipeline, which is what this hooks into.
 *
 * Reading view is deliberately left alone: it renders through the same
 * pipeline, but the "Show reminder pills in editor" setting only promises
 * pills in the editor, and a pill there would have no editable text to fall
 * back to.  The `.cm-embed-block` ancestor is what tells the two apart.
 */
export function createRenderedBlockPillPostProcessor(
  plugin: ReminderPlugin,
): MarkdownPostProcessor {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    if (!plugin.settings.editorReminderDisplay.value) {
      return;
    }
    if (el.closest(RENDERED_BLOCK_SELECTOR) == null) {
      return;
    }
    for (const item of Array.from(el.querySelectorAll("li.task-list-item"))) {
      decorateRenderedTaskItem(item, ctx.sourcePath, (reminder) =>
        buildPill(plugin, ctx, reminder),
      );
    }
  };
}

function buildPill(
  plugin: ReminderPlugin,
  ctx: MarkdownPostProcessorContext,
  reminder: Reminder,
): HTMLElement {
  const container = document.createElement("span");
  const component = new ReminderPillComponent({
    target: container,
    props: {
      label: `⏰ ${reminder.time.toString()}`,
      title: `Reminder: ${reminder.title}`,
    },
  });
  component.$on("activate", () => {
    // Fire-and-forget: this is a user-initiated action from a DOM event
    // handler, there's nothing to await it against.
    void editReminder(plugin, ctx.sourcePath, reminder);
  });
  ctx.addChild(new ReminderPillRenderChild(container, component));
  return container;
}

type ResolvedReminder = {
  file: TFile;
  content: Content;
  reminder: Reminder;
};

/**
 * Re-reads the note and finds the line the clicked pill stands for.
 *
 * The pill was built from rendered HTML, which carries no line number, so the
 * reminder has to be looked up again in the file — and looked up twice, since
 * the note can change while the chooser modal is open.
 */
async function resolve(
  plugin: ReminderPlugin,
  sourcePath: string,
  rendered: Reminder,
): Promise<ResolvedReminder | null> {
  const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) {
    return null;
  }
  const content = new Content(file.path, await plugin.app.vault.read(file));
  const reminder = resolveRenderedReminder(
    content.getReminders(false),
    rendered,
  );
  if (reminder === null) {
    return null;
  }
  return { file, content, reminder };
}

async function editReminder(
  plugin: ReminderPlugin,
  sourcePath: string,
  rendered: Reminder,
): Promise<void> {
  const initial = await resolve(plugin, sourcePath, rendered);
  if (initial === null) {
    new Notice("Couldn't locate this reminder in the note.");
    return;
  }

  let chosen;
  try {
    chosen = await showDateTimeChooserModal(
      plugin.app,
      plugin.reminders,
      plugin.settings.reminderTimeStep.value,
      Number(plugin.settings.weekStart.value),
      initial.reminder.time,
    );
  } catch {
    // The chooser was cancelled; leave the note untouched.
    return;
  }

  const current = await resolve(plugin, sourcePath, rendered);
  if (current === null) {
    new Notice("Couldn't locate this reminder in the note.");
    return;
  }
  await current.content.updateReminder(current.reminder, { time: chosen });
  await plugin.app.vault.modify(current.file, current.content.getContent());
}
