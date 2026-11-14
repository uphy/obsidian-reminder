// Display tour: puts one screen on display per call, for a screenshot and
// for reading the wording. Nothing is asserted; the result lists the texts
// on the screen and the rows whose content is wider than the row.
//
//   qa-run.sh --step setup cases/60-display-tour.js
//   qa-run.sh --step settings@zh-cn --shot settings-zh.png cases/60-display-tour.js
//
// Steps: setup, settings, settings-bottom, main, dialog-new, dialog-error,
// dialog-edit, dialog-long, dialog-done, dialog-foreign, dialog-two, close.
// Every step but `setup` takes `@en`, `@ja` or `@zh-cn`.
const D = "QA/look/";
const LONG = "Quarterly business review with the Acme Corporation account team and legal";
const dlg = () => document.querySelector(".note-reminder-editor");
const closeDlg = () => dlg()?.closest(".modal-container")?.querySelector(".modal-close-button, .modal-header-button")?.click();
const open = async (name) => {
  closeDlg(); closeToasts(); document.querySelector("#qa-settings")?.remove();
  await sleep(200);
  await app.workspace.getLeaf(false).openFile(file(D + name + ".md")); await sleep(700);
  app.commands.executeCommandById("obsidian-reminder-plugin:set-note-reminder"); await sleep(900);
  const m = dlg().closest(".modal");
  out.width = { modal: Math.round(m.getBoundingClientRect().width), calendar: Math.round(dlg().querySelector(".dtchooser")?.getBoundingClientRect().width ?? 0) };
  out.title = m.querySelector(".modal-title")?.textContent;
  out.text = dlg().innerText.replace(/\n+/g, " | ").slice(0, 800);
  out.placeholders = [...dlg().querySelectorAll("input[placeholder]")].map((i) => i.placeholder);
};
const twoSources = [{ property: "reminder", managed: true, since: "" }, { property: "follow-up", managed: false, since: day(-10) }, { property: "check", managed: false, since: "" }];

if (STEP === "setup") {
  closeToasts(); closeDlg(); document.querySelector("#qa-settings")?.remove();
  await rm("QA");
  setSetting("taskNotesSince", ""); setSetting("taskNotesEnabled", true);
  setSetting("noteReminderSources", twoSources);
  await mk(D + "Plain.md", "# Plain\n");
  await mk(D + "Acme Corp.md", `---\nfollow-up: ${at(-2)}\n---\n# Acme Corp\n\n- [ ] Call the accountant (@${M().add(-1, "minutes").format("YYYY-MM-DD HH:mm")})\n`);
  await mk(D + "Rent.md", `---\nreminder: ${at(-2)}\nreminder-title: Pay the rent\nreminder-repeat: every month\n---\n`);
  await mk(D + "Report.md", `---\ntitle: Send the quarterly report to the finance team and the auditors\nstatus: open\ntags:\n  - task\ndue: ${M().add(12, "minutes").format("YYYY-MM-DDTHH:mm")}\nreminders:\n  - id: rem_1\n    type: relative\n    relatedTo: due\n    offset: -PT15M\n    description: 15 minutes before the due date of this task, as a first warning\n---\n`);
  await mk(D + LONG + ".md", `---\nreminder: ${at(-2)}\nfollow-up: ${at(-2)}\n---\n- [ ] Prepare the quarterly business review deck and send it to everyone on the account team before the meeting (@${M().add(-1, "minutes").format("YYYY-MM-DD HH:mm")})\n`);
  await mk(D + "Later.md", `---\nfollow-up: ${day(2)}\nreminder: ${day(9)}T10:00:00\n---\n`);
  await mk(D + "Old.md", `---\nfollow-up: ${day(-30)}\n---\n`);
  await mk(D + "Done.md", `---\nreminder: ${day(-1)}\nreminder-done: ${day(-1)}\n---\n`);
  await mk(D + "Foreign.md", `---\nreminder: next week maybe, ask Alice about the exact day\n---\n`);
  await mk(D + "Coll.md", `---\ncheck: ${day(-1)}\ncheck-done: true\n---\n`);
  await mk(D + "Bad.md", `---\nreminder: ${at(-2)}\nreminder-repeat: now and then\n---\n`);
  await sleep(1500);
  return "ok";
}
if (STEP === "settings") {
  closeToasts(); closeDlg();
  document.querySelector("#qa-settings")?.remove();
  const c = document.body.createDiv({ cls: "modal-container", attr: { id: "qa-settings" } }); c.style.zIndex = "99999";
  c.createDiv("modal-bg").style.opacity = "0.85";
  const mm = c.createDiv("modal mod-settings"); mm.style.cssText = "width:1000px;height:1150px;max-height:96vh;overflow:auto;padding:0";
  const m = mm.createDiv("vertical-tab-content");
  s.settings.displayOn(m); await sleep(800);
  out.tabs = [...m.querySelectorAll(".reminder-settings-tab")].map((t) => t.textContent.trim());
  // The fourth tab is "Note reminders" in every language.
  [...m.querySelectorAll(".reminder-settings-tab")][3].click(); await sleep(800);
  out.text = m.innerText;
  out.placeholders = [...m.querySelectorAll("input[placeholder]")].map((i) => i.placeholder);
  out.options = [...m.querySelectorAll("select:not(.is-measuring) option")].map((o) => o.textContent);
  out.tooltips = [...m.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"));
  out.overflow = [...m.querySelectorAll(".setting-item")].filter((i) => i.scrollWidth > i.clientWidth + 1).map((i) => i.querySelector(".setting-item-name")?.textContent);
}
if (STEP === "settings-bottom") { const mm = document.querySelector("#qa-settings .modal"); mm.scrollTop = mm.scrollHeight; }
if (STEP === "main") {
  closeDlg(); document.querySelector("#qa-settings")?.remove();
  await app.workspace.getLeaf(false).openFile(file(D + "Rent.md"));
  app.commands.executeCommandById("obsidian-reminder-plugin:show-reminders");
  await sleep(1500);
  // Show the notifications again if an earlier step closed them.
  p.reminders.reminders.forEach((r) => { if (r.file.includes(D)) r.muteNotification = false; });
  await waitFor(() => toasts().length >= 4, 12000); await sleep(500);
  out.toasts = toasts().map((t) => t.innerText.replace(/\n+/g, " | "));
  out.snooze = toasts()[0] ? tOptions(toasts()[0]) : [];
  out.list = document.querySelector(".workspace-leaf-content[data-type='reminder-list'] .view-content")?.innerText.replace(/\n+/g, " | ");
  out.bell = document.querySelector(".workspace-leaf.mod-active .reminder-note-indicator")?.getAttribute("aria-label");
  out.commands = Object.values(app.commands.commands).filter((c) => c.id.startsWith("obsidian-reminder-plugin")).map((c) => c.name);
  // The two notices: "-done" holds another value, and an unreadable rule.
  const coll = toast("Coll"); if (coll) tDone(coll);
  const bad = toast("Bad"); if (bad) tDone(bad);
  await sleep(1200);
  out.notices = notices();
}
if (STEP === "dialog-new") await open("Plain");
if (STEP === "dialog-error") {
  await open("Plain");
  const rep = [...dlg().querySelectorAll('input[type="text"]')][1]; rep.value = "now and then"; rep.dispatchEvent(new Event("input", { bubbles: true })); await sleep(300);
  out.error = dlg().querySelector(".note-reminder-error")?.textContent.trim();
}
if (STEP === "dialog-edit") await open("Later");
if (STEP === "dialog-long") await open(LONG);
if (STEP === "dialog-done") await open("Done");
if (STEP === "dialog-foreign") await open("Foreign");
if (STEP === "dialog-two") {
  setSetting("noteReminderSources", [{ property: "reminder", managed: true, since: "" }, { property: "deadline-for-the-project", managed: true, since: "" }]);
  await open("Plain");
  setSetting("noteReminderSources", twoSources);
}
if (STEP === "close") { closeDlg(); closeToasts(); document.querySelector("#qa-settings")?.remove(); }
return out;
