closeToasts();
setSetting("excludedPaths", ""); setSetting("noteReminderSources", []); setSetting("taskNotesSince", ""); setSetting("taskNotesEnabled", true); await rescan();
const D = "QA/tn/";
const tn = app.plugins.plugins.tasknotes;
const calls = [];
const orig = tn.api.tasks.setReminders.bind(tn.api.tasks);
tn.api.tasks.setReminders = async (...a) => { calls.push(a[0].split("/").pop()); return orig(...a); };
try {
const F = "YYYY-MM-DDTHH:mm";
const task = (title, extra) => `---\ntitle: ${title}\nstatus: open\npriority: normal\ntags:\n  - task\n${extra}\n---\nbody\n`;
const rel = (id, to, off, desc) => `  - id: ${id}\n    type: relative\n    relatedTo: ${to}\n    offset: ${off}${desc ? `\n    description: ${desc}` : ""}`;
const due = M().add(10, "minutes");
const remT = due.clone().add(-15, "minutes").format("YYYY-MM-DDTHH:mm:00");
for (const n of ["U1 done", "U2 snooze"]) await mk(D + n + ".md", task(n, `due: ${due.format(F)}\nreminders:\n${rel("rem_1", "due", "-PT15M", "before due")}`));
const t1 = await waitFor(() => toast("U1 done")); const t2 = await waitFor(() => toast("U2 snooze"));
ok("U toasts shown", t1 && t2);
// Done
tDone(t1); await sleep(1500);
out.u1 = await fmOf(D + "U1 done.md");
ok("U1 Done records reminders-done and leaves the entry", out.u1.includes(`reminders-done:\n  - rem_1@${remT}`) && out.u1.includes("offset: -PT15M") && !out.u1.includes("snooze"), out.u1);
ok("U1 Done does not call TaskNotes' API", !calls.includes("U1 done.md"), calls);
ok("U1 not pending", rems(D).filter((r) => r.file === "U1 done.md").length === 0);
ok("U1 task is still open in TaskNotes", (await tn.api.tasks.get(D + "U1 done.md"))?.status === "open");
// due moved -> pending again
await mk(D + "U1 done.md", (await read(D + "U1 done.md")).replace(`due: ${due.format(F)}`, `due: ${due.clone().add(1, "day").format(F)}`));
await sleep(1200);
ok("U1 pending again when the due date moves", rems(D).filter((r) => r.file === "U1 done.md").length === 1, rems(D));
// Snooze
tSnooze(t2, "In 30 minutes"); await sleep(2000);
out.u2 = await fmOf(D + "U2 snooze.md");
ok("U2 snooze adds one entry and the record", out.u2.includes("id: obsidian-reminder-snooze-rem_1") && out.u2.includes(`reminders-done:\n  - rem_1@${remT}`) && out.u2.includes("description: before due"), out.u2);
ok("U2 snooze went through TaskNotes' API once", calls.filter((c) => c === "U2 snooze.md").length === 1, calls);
const seen = (await tn.api.tasks.get(D + "U2 snooze.md"))?.reminders;
ok("U2 TaskNotes lists the added reminder", seen?.length === 2 && seen[1].id === "obsidian-reminder-snooze-rem_1", seen);
const r2 = rems(D).filter((r) => r.file === "U2 snooze.md");
ok("U2 one reminder at the snoozed time", r2.length === 1 && Math.abs(M(r2[0].time).diff(M().add(30, "minutes"), "minutes")) <= 1, r2);
// Done on the snoozed entry (via the service, it is not due yet)
const live = p.reminders.reminders.find((r) => r.file.endsWith("U2 snooze.md"));
out.u2done = await p._noteReminders.apply(live, { type: "done", expected: live.time, now: live.time });
await sleep(1500);
out.u2b = await fmOf(D + "U2 snooze.md");
ok("U2 Done on the snoozed reminder removes the added entry", out.u2done === "applied" && !out.u2b.includes("obsidian-reminder-snooze") && out.u2b.includes("reminders-done"), out.u2b);
ok("U2 removal also went through the API", calls.filter((c) => c === "U2 snooze.md").length === 2, calls);
ok("U2 nothing pending", rems(D).filter((r) => r.file === "U2 snooze.md").length === 0);
} finally { tn.api.tasks.setReminders = orig; }
return finish();
