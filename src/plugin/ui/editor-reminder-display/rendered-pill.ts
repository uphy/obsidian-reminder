import { parseReminder } from "model/format";
import { MarkdownDocument } from "model/format/markdown";
import type { Reminder } from "model/reminder";

/** Length of the `"- [x] "` prefix prepended to a rendered task item's text. */
const SYNTHETIC_PREFIX_LENGTH = 6;

/**
 * A reminder found inside a rendered task list item, addressed by
 * `[from, to)` offsets into the item's own text (the concatenation of its
 * text nodes, nested sub-lists excluded).
 */
export type RenderedReminderSpan = {
  reminder: Reminder;
  from: number;
  to: number;
};

/**
 * Parses `text` as the body of a task line and locates the first reminder in
 * it.
 *
 * The text comes from already-rendered HTML, not from the file, so its
 * offsets are the rendered ones: markdown that the renderer consumed (`**`,
 * link syntax, …) is gone.  That is exactly what the caller needs — it has to
 * address text nodes, not source columns — and it works because every
 * reminder format writes its time as literal characters that survive
 * rendering untouched.
 *
 * `checkChar` is the task's status character so that formats which read it
 * (a Tasks-plugin ✅ done date, for instance) see the same line the file has.
 */
export function findReminderInRenderedText(
  sourcePath: string,
  text: string,
  checkChar: string,
): RenderedReminderSpan | null {
  const check = checkChar.length === 1 ? checkChar : " ";
  const doc = new MarkdownDocument(sourcePath, `- [${check}] ${text}`);
  const span = parseReminder(doc)[0];
  if (span === undefined) {
    return null;
  }
  const from = span.columnStart - SYNTHETIC_PREFIX_LENGTH;
  const to = span.columnEnd - SYNTHETIC_PREFIX_LENGTH;
  if (from < 0 || to > text.length || from >= to) {
    return null;
  }
  return { reminder: span.reminder, from, to };
}

/**
 * Collects the text nodes that belong to `item` itself, skipping nested
 * sub-lists: a nested task is a task list item of its own and gets decorated
 * on its own turn.
 */
function collectOwnTextNodes(item: Element): Array<Text> {
  const texts: Array<Text> = [];
  const visit = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        texts.push(child as Text);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const tagName = (child as Element).tagName;
      if (tagName === "UL" || tagName === "OL") {
        continue;
      }
      visit(child);
    }
  };
  visit(item);
  return texts;
}

/** Reads the task's status character from the `data-task` attribute Obsidian puts on rendered task items. */
function checkCharOf(item: Element): string {
  const task = item.getAttribute("data-task");
  return task === null || task === "" ? " " : task;
}

/**
 * Replaces the reminder time inside one rendered task list item with the
 * element `createPill` builds for it.
 *
 * Returns `false` — leaving the DOM untouched — when the item holds no
 * reminder, or when the reminder text is split across several text nodes
 * (which means the renderer put markup inside it, and there is no single node
 * to swap).
 */
export function decorateRenderedTaskItem(
  item: Element,
  sourcePath: string,
  createPill: (reminder: Reminder) => HTMLElement,
): boolean {
  const textNodes = collectOwnTextNodes(item);
  const text = textNodes.map((node) => node.data).join("");
  const span = findReminderInRenderedText(sourcePath, text, checkCharOf(item));
  if (span === null) {
    return false;
  }

  let offset = 0;
  for (const node of textNodes) {
    const end = offset + node.data.length;
    if (span.from >= offset && span.to <= end) {
      const reminderNode = node.splitText(span.from - offset);
      reminderNode.splitText(span.to - span.from);
      reminderNode.replaceWith(createPill(span.reminder));
      return true;
    }
    offset = end;
  }
  return false;
}
