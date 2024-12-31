<script>
  import { createEventDispatcher } from 'svelte';
  import { TimedInputHandler } from './timed-input-handler';
  export let value = "00:00";
  // step in minutes
  export let step = 15;
  export let autofocus = false;
 
  const dispatch = createEventDispatcher();

  function handleSelect() {
    dispatch('select', value);
  }

  function handleFocus() {
    dispatch('focus');
  }

  function handleBlur() {
    dispatch('blur');
  }

  function generateOptions() {
    let options = [];
    for (let i = 0; i < 60 * 24; i += step) {
      const hour = Math.floor(i / 60);
      const minute = i % 60;
      options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
    return options;
  }

  const options = generateOptions();

  const timedInputHandler = new TimedInputHandler();
  function handleKeyDown(event) {
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      const input = timedInputHandler.handle(event.key);
      switch(input.length){
        case 2:
          const prefix = input + ":";
          const candidates = options.filter(o => o.startsWith(prefix));
          if (candidates.length > 1) {
            value = candidates[0];
          }
          break;
        case 4:
          const time = input.slice(0, 2) + ":" + input.slice(2, 4);
          if (options.includes(time)) {
            value = time;
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

<style>
  .time-picker {
    padding: 0 0.5rem;
  }
  select.time-picker:focus {
    box-shadow: 0 0 0px 1px var(--background-modifier-border-focus);
  }
</style>

<select class="time-picker" bind:value={value} on:dblclick={handleSelect} on:focus={handleFocus} on:blur={handleBlur} on:keydown={handleKeyDown}>
  {#each options as option}
    <option value={option}>{option}</option>
  {/each}
</select>