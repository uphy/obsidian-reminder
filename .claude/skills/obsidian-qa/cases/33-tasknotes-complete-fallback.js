closeToasts();
setSetting("excludedPaths", ""); setSetting("noteReminderSources", []); setSetting("taskNotesSince", ""); setSetting("taskNotesEnabled", true);
const D = "QA/tn3/";
await rm("QA/tn2"); await rm("QA/tn3");
let tn = app.plugins.plugins.tasknotes;
const F = "YYYY-MM-DDTHH:mm";
const task = (title, extra) => `---\ntitle: ${title}\nstatus: open\npriority: normal\ntags:\n  - task\n${extra}\n---\nbody\n`;
// W1: complete a task in TaskNotes -> its reminder goes away
await mk(D + "W1.md", task("W1 complete in TaskNotes", `due: ${M().add(2, "hours").format(F)}\nreminders:\n  - id: rem_1\n    type: relative\n    relatedTo: due\n    offset: -PT15M`));
await mk(D + "W2.md", task("W2 recurring", `scheduled: ${day(0)}\nrecurrence: FREQ=DAILY\nreminders:\n  - id: rem_1\n    type: relative\n    relatedTo: scheduled\n    offset: PT23H`));
await sleep(2500);
ok("W1/W2 read", rems(D).length === 2, rems(D));
out.w2before = rems(D).find((r) => r.file === "W2.md")?.time;
await tn.api.tasks.complete(D + "W1.md"); await sleep(2000);
out.w1 = await fmOf(D + "W1.md");
ok("W1 completing in TaskNotes removes the reminder", !rems(D).some((r) => r.file === "W1.md"), out.w1);
await tn.api.tasks.uncomplete(D + "W1.md"); await sleep(2000);
out.w1b = await fmOf(D + "W1.md");
ok("W1 reopening brings it back", rems(D).some((r) => r.file === "W1.md"), out.w1b);
// W2: complete today's occurrence of a recurring task in TaskNotes
await tn.api.recurring.toggleCompleteInstance(D + "W2.md"); await sleep(2000);
out.w2 = await fmOf(D + "W2.md");
out.w2after = rems(D).find((r) => r.file === "W2.md")?.time;
ok("W2 completing an occurrence in TaskNotes moves the reminder to the next one", out.w2after && out.w2after !== out.w2before && M(out.w2after).isAfter(M(out.w2before)), [out.w2before, out.w2after]);
// W3: TaskNotes turned off -> saved copy, direct write
out.sourceOn = (p.taskNotesDefaultsCache = undefined, p.taskNotesDefaults().source);
await app.plugins.disablePlugin("tasknotes"); await sleep(1500);
p.taskNotesDefaultsCache = undefined;
out.sourceOff = p.taskNotesDefaults().source;
ok("W3 without TaskNotes the saved copy is used", out.sourceOff === "saved", out.sourceOff);
await mk(D + "W3.md", task("W3 without TaskNotes", `reminders:\n  - id: rem_1\n    type: absolute\n    absoluteTime: ${at(-2)}`));
const t = await waitFor(() => toast("W3 without TaskNotes"));
ok("W3 still read and notified without TaskNotes", t);
if (t) { tSnooze(t, "In 1 hour"); await sleep(1800); out.w3 = await fmOf(D + "W3.md"); ok("W3 snooze written directly", out.w3.includes("obsidian-reminder-snooze-rem_1") && out.w3.includes("reminders-done") && !out.w3.includes("dateModified"), out.w3); }
await app.plugins.enablePlugin("tasknotes"); await sleep(3000);
tn = app.plugins.plugins.tasknotes;
p.taskNotesDefaultsCache = undefined;
out.sourceBack = p.taskNotesDefaults().source;
ok("W3 TaskNotes back: its settings are used again", out.sourceBack === "tasknotes", out.sourceBack);
const seen = (await tn.api.tasks.get(D + "W3.md"))?.reminders;
ok("W3 TaskNotes reads the note written without it", seen?.length === 2, seen);
// W4: since cut-off
setSetting("taskNotesSince", day(0));
await mk(D + "W4.md", task("W4 before cut-off", `reminders:\n  - id: old\n    type: absolute\n    absoluteTime: ${M().add(-2, "days").format("YYYY-MM-DDTHH:mm:00")}\n  - id: new\n    type: absolute\n    absoluteTime: ${at(90)}`));
await sleep(1500);
const w4 = rems(D).filter((r) => r.file === "W4.md").map((r) => r.origin.key);
ok("W4 reminders before the cut-off are not read", w4.join() === "new", w4);
setSetting("taskNotesSince", "");
// W5: reading off
setSetting("taskNotesEnabled", false); await rescan();
ok("W5 reading off: no TaskNotes reminders", rems(D).length === 0, rems(D));
setSetting("taskNotesEnabled", true); await rescan();
ok("W5 reading on again", rems(D).length >= 3, rems(D).length);
return finish();
