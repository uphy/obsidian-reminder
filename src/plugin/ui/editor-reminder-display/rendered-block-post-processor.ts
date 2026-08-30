import type ReminderPlugin from "main";
import type { Reminder } from "model/reminder";
import { EditorView } from "@codemirror/view";
import type {
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
} from "obsidian";
import { MarkdownRenderChild } from "obsidian";
import { openChooserAndApplyEdit } from "./edit-reminder";
import type { ReminderLocation } from "./edit-reminder";
import { decorateRenderedTaskItem } from "./rendered-pill";
import ReminderPillComponent from "./ReminderPill.svelte";

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
    void activate(plugin, container);
  });
  ctx.addChild(new ReminderPillRenderChild(container, component));
  return container;
}

async function activate(
  plugin: ReminderPlugin,
  container: HTMLElement,
): Promise<void> {
  const editorEl = container.closest(".cm-editor");
  const view =
    editorEl instanceof HTMLElement ? EditorView.findFromDOM(editorEl) : null;
  if (view === null) {
    return;
  }
  try {
    await openChooserAndApplyEdit(view, plugin, () =>
      locateRenderedPill(view, container),
    );
  } catch {
    // The chooser was cancelled (or a genuine failure occurred); either way
    // there's nothing to recover, leave the document untouched.
  }
}

/**
 * Works out which source line the pill stands for.
 *
 * The pill sits inside a block widget that replaces the whole block, so
 * `posAtDOM()` resolves to the block's *first* line however deep the pill is
 * — every pill in one callout would otherwise answer with the same position.
 * Obsidian stamps each rendered task's checkbox with `data-line`, its 0-based
 * offset within that block, which is exactly what closes the gap.  Nested
 * task items carry their own offset, so they resolve to their own line.
 */
function locateRenderedPill(
  view: EditorView,
  container: HTMLElement,
): ReminderLocation | null {
  if (!view.dom.contains(container)) {
    // The block was re-rendered while e.g. the chooser modal was open;
    // posAtDOM() would throw on a detached node.
    return null;
  }
  const item = container.closest("li.task-list-item");
  const offset = Number(
    item?.querySelector("input[data-line]")?.getAttribute("data-line"),
  );
  if (!Number.isInteger(offset) || offset < 0) {
    return null;
  }
  const blockStart = view.state.doc.lineAt(view.posAtDOM(container)).number;
  return { lineNumber: blockStart + offset };
}
