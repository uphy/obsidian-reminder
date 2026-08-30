import type ReminderPlugin from "main";
import { EditorView, WidgetType } from "@codemirror/view";
import { openChooserAndApplyEdit } from "./edit-reminder";
import type { ReminderLocation } from "./edit-reminder";
import type { ReminderPillSpan } from "./types";
import ReminderPillComponent from "./ReminderPill.svelte";

/** Renders a single reminder's time text as a clickable "⏰ <time>" pill. */
export class ReminderPillWidget extends WidgetType {
  private component?: ReminderPillComponent;

  constructor(
    private readonly span: ReminderPillSpan,
    private readonly plugin: ReminderPlugin,
  ) {
    super();
  }

  override eq(other: ReminderPillWidget): boolean {
    // Compare content only, not positions: the click flow re-resolves the
    // reminder from the widget's current DOM position, so correctness never
    // depends on the captured span. Ignoring positions lets CodeMirror keep
    // the DOM of every pill below an unrelated edit instead of tearing it
    // down and rebuilding it on each decoration rebuild.
    return (
      this.span.text === other.span.text &&
      this.span.reminder.title === other.span.reminder.title
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const container = document.createElement("span");
    this.component = new ReminderPillComponent({
      target: container,
      props: {
        label: `⏰ ${this.span.reminder.time.toString()}`,
        title: `Reminder: ${this.span.reminder.title}`,
      },
    });
    this.component.$on("activate", () => {
      // Fire-and-forget: this is a user-initiated action from a DOM event
      // handler, there's nothing to await it against.
      void this.activate(view, container);
    });
    return container;
  }

  override destroy(): void {
    this.component?.$destroy();
    this.component = undefined;
  }

  override ignoreEvent(): boolean {
    return false;
  }

  private async activate(
    view: EditorView,
    container: HTMLElement,
  ): Promise<void> {
    try {
      await openChooserAndApplyEdit(view, this.plugin, () =>
        locatePill(view, container),
      );
    } catch {
      // The chooser was cancelled (or a genuine failure occurred); either
      // way there's nothing to recover, leave the document untouched.
    }
  }
}

/**
 * Reads the pill's line straight off its own DOM position, which — unlike the
 * span captured when the decoration was built — is always current.
 */
function locatePill(
  view: EditorView,
  container: HTMLElement,
): ReminderLocation | null {
  if (!view.dom.contains(container)) {
    // The widget was removed while e.g. the chooser modal was open;
    // posAtDOM() would throw on a detached node.
    return null;
  }
  const pos = view.posAtDOM(container);
  return { lineNumber: view.state.doc.lineAt(pos).number, preferPos: pos };
}
