/**
 * CSS injection for reminder pill styling (idempotent)
 */
let reminderPillStylesInjected = false;

export function ensureReminderPillStylesInjected(): void {
  if (reminderPillStylesInjected) return;

  try {
    if (typeof document === "undefined") {
      // environment without DOM (e.g., tests); mark as injected to avoid loops
      return;
    }
    const head = document.head ?? document.getElementsByTagName("head")[0];
    if (!head) {
      return;
    }
    const style = document.createElement("style");
    style.setAttribute("data-reminder-pill-styles", "true");
    style.textContent = `
.reminder-pill {
  background: var(--tag-background);
  border: 1px solid var(--tag-border-color);
  color: var(--text-normal);
  border-radius: calc(var(--radius-s) + 4px);
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}
.reminder-pill:hover, .reminder-pill:focus {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 1px;
  background: color-mix(in srgb, var(--tag-background) 85%, var(--interactive-accent) 15%);
}
.reminder-pill__inner { font-size: 0.95em; }
`.trim();
    head.appendChild(style);
  } catch {
    // ignore DOM injection errors
  } finally {
    reminderPillStylesInjected = true;
  }
}
