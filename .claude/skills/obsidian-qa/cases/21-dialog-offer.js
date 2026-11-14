const D = "QA/managed/";
const modal = () => document.querySelector(".modal-container .modal");
const bell = () => document.querySelector(".workspace-leaf.mod-active .reminder-note-indicator");
ok("B1 bell is idle (+) on a note without a reminder", bell()?.classList.contains("is-idle"), bell()?.className);
// cancel first
[...modal().querySelectorAll("button")].find((b) => b.textContent === "Cancel").click(); await sleep(500);
ok("B1 cancel adds no property", s.noteReminderSources.rawValue.value.length === 0);
bell().click(); await sleep(800);
ok("B1 the bell opens the same offer", modal()?.textContent.includes("reminder"));
modal().querySelector("button.mod-cta").click(); await sleep(1200);
out.sources = JSON.parse(JSON.stringify(s.noteReminderSources.rawValue.value));
ok("B1 accepting adds 'reminder' as managed", out.sources.length === 1 && out.sources[0].property === "reminder" && out.sources[0].managed === true, out.sources);
const dlg = () => document.querySelector(".note-reminder-editor");
ok("B1 the editor dialog opens next", dlg());
out.dlgHtml = dlg()?.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, "").slice(0, 6000);
return finish();
