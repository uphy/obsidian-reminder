<script>
  import { createEventDispatcher } from "svelte";
  import { timeOptions } from "./time-options";
  import { TimedInputHandler } from "./timed-input-handler";
  export let value = "00:00";
  // step in minutes
  export let step = 15;

  const dispatch = createEventDispatcher();

  function handleSelect() {
    dispatch("select", value);
  }

  function handleFocus() {
    dispatch("focus");
  }

  function handleBlur() {
    dispatch("blur");
  }

  // Includes the current value when it is not on a step, so the select is
  // never left blank.
  const options = timeOptions(step, value);

  const timedInputHandler = new TimedInputHandler();
  function handleKeyDown(event) {
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      const input = timedInputHandler.handle(event.key);
      switch (input.length) {
        case 1:
          {
            const hour = input.padStart(2, "0");
            const candidates = options.filter((o) => o.startsWith(hour));
            if (candidates.length > 1) {
              value = candidates[0];
            }
          }
          break;
        case 2: {
          const prefix = input + ":";
          const candidates = options.filter((o) => o.startsWith(prefix));
          if (candidates.length > 1) {
            value = candidates[0];
          }
          break;
        }
        case 4:
          {
            const time = input.slice(0, 2) + ":" + input.slice(2, 4);
            if (options.includes(time)) {
              value = time;
            }
          }
          break;
      }
      return;
    }
    timedInputHandler.clear();

    if (event.key === "Enter") {
      handleSelect();
      event.preventDefault();
      return;
    }
  }
</script>

<select
  class="time-picker"
  bind:value
  on:dblclick={handleSelect}
  on:focus={handleFocus}
  on:blur={handleBlur}
  on:keydown={handleKeyDown}
>
  {#each options as option (option)}
    <option value={option}>{option}</option>
  {/each}
</select>

<style>
  .time-picker {
    padding: 0 0.5rem;
  }
  select.time-picker:focus {
    box-shadow: 0 0 0px 1px var(--background-modifier-border-focus);
  }
</style>
