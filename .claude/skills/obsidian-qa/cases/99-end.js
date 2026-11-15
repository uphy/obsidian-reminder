document.querySelector("#qa-settings")?.remove();
// Deletes the QA notes, puts the settings back as they were before the run
// and saves them.
closeToasts();
document.querySelector("#qa-settings")?.remove();
document.querySelector(".note-reminder-editor")?.closest(".modal-container")?.querySelector(".modal-close-button, .modal-header-button")?.click();
await rm("QA");
const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY));
for (const [k, v] of Object.entries(snapshot.settings)) if (s[k]) s[k].rawValue.value = v;
for (const [k, v] of Object.entries(snapshot.names)) if (s.taskNotesPropertyNames?.[k]) s.taskNotesPropertyNames[k].rawValue.value = v;
p._data.changed = true;
await p._data.save(true);
localStorage.removeItem(SNAPSHOT_KEY);
await app.plugins.disablePlugin("obsidian-reminder-plugin");
await app.plugins.enablePlugin("obsidian-reminder-plugin");
await sleep(2000);
const q = app.plugins.plugins["obsidian-reminder-plugin"];
return {
  reminders: q.reminders.reminders.length,
  language: q.settings.language.rawValue.value,
  noteReminderSources: q.settings.noteReminderSources?.rawValue.value,
  taskNotesEnabled: q.settings.taskNotesEnabled?.rawValue.value,
  mobile: document.body.classList.contains("is-mobile"),
  qaNotesLeft: app.vault.getMarkdownFiles().filter((f) => f.path.startsWith("QA/")).length,
};
