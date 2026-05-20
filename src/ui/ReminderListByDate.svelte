<script lang="typescript">
  import moment from "moment";
  import { DateTime } from "../model/time";
  import type { Reminder } from "../model/reminder";
  import Markdown from "./Markdown.svelte";

  export let reminders: Array<Reminder>;
  export let onOpenReminder: (reminder: Reminder) => void = () => {};
  export let timeToString = (time: DateTime) => time.format("HH:MM");
  export let generateLink: (reminder: Reminder) => string = () => "";
  export let onRescheduleContext: (event: MouseEvent | TouchEvent, reminder: Reminder) => void = () => {};
  export let isOverdue: boolean = false;

  // Long-press detection for non-overdue reminders
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressTriggered = false;
  const LONG_PRESS_DURATION = 500; // ms

  function handleTouchStart(e: TouchEvent, reminder: Reminder) {
    if (isOverdue) return; // overdue uses regular click, no long-press needed
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      onRescheduleContext(e as unknown as TouchEvent, reminder);
    }, LONG_PRESS_DURATION);
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleTouchMove() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleContextMenu(e: MouseEvent, reminder: Reminder) {
    e.preventDefault();
    e.stopPropagation();
    onRescheduleContext(e, reminder);
  }

  function handleClick(e: MouseEvent, reminder: Reminder) {
    if (longPressTriggered) {
      longPressTriggered = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isOverdue) {
      // Overdue reminders: regular click opens reschedule menu
      e.preventDefault();
      e.stopPropagation();
      onRescheduleContext(e, reminder);
      return;
    }
    // Non-overdue reminders: regular click opens reminder modal (original behavior)
    onOpenReminder(reminder);
  }
</script>

<div class="reminder-group">
  {#if reminders.length === 0}
    <div class="reminder-list-item no-reminders">No reminders</div>
  {:else}
    <div>
      {#each reminders as reminder}
        <button
          class="reminder-list-item hover-highlight"
          class:is-overdue={isOverdue}
          aria-label={`[${reminder.time.toString()}] ${
            reminder.title
          } - ${reminder.getFileName()}`}
          draggable="true"
          on:dragstart={(e) => {
            e.dataTransfer?.setData("text/plain", generateLink(reminder));
          }}
          on:click={(e) => handleClick(e, reminder)}
          on:contextmenu={(e) => handleContextMenu(e, reminder)}
          on:touchstart={(e) => handleTouchStart(e, reminder)}
          on:touchend={(e) => handleTouchEnd()}
          on:touchmove={(e) => handleTouchMove()}
        >
          <span class="reminder-time">
            {timeToString(reminder.time)}
          </span>
          <div class="reminder-title-container">
            <span class="reminder-title">
              <Markdown markdown={reminder.title} sourcePath={reminder.file} />
            </span>
            <span class="reminder-file">
              {reminder.getFileName()}
            </span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  button {
    background-color: transparent;
    box-shadow: none;
    justify-content: flex-start;
    gap: 0.3rem;
    display: inline-flex;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .reminder-group {
    margin-bottom: 1rem;
    font-size: 13px;
    color: var(--text-muted);
  }
  .reminder-list-item {
    padding: 3px;
    width: 100%;
  }
  .reminder-list-item:hover {
    color: var(--text-normal);
    background-color: var(--background-secondary-alt);
  }
  .reminder-list-item.is-overdue {
    color: var(--text-accent);
  }
  .reminder-time {
    display: inline-block;
    font-size: 14px;
    font-family: monospace, serif;
  }
  .reminder-title-container {
    display: inline-flex;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-grow: 1;
    justify-content: flex-start;
    align-items: center;
  }
  .reminder-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-grow: 1;
    text-align: left;
  }
  .reminder-file {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color: var(--text-faint);
  }
  .no-reminders {
    font-style: italic;
  }
  .no-reminders:hover {
    color: var(--text-muted);
    background-color: transparent;
  }
</style>
