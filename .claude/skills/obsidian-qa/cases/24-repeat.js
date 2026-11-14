closeToasts();
const D = "QA/repeat/";
await rm("QA/repeat");
setSetting("noteReminderSources", [{ property: "reminder", managed: true, since: "" }, { property: "follow-up", managed: false, since: "" }]);
const F = "YYYY-MM-DDTHH:mm:00";
const base = M().add(-3, "minutes");
const b = base.format(F);
await mk(D + "R1 monthly.md", `---\nreminder: ${b}\nreminder-title: Pay the rent\nreminder-repeat: every month\n---\n`);
await mk(D + "R2 whendone.md", `---\nreminder: ${M().add(-3, "days").format("YYYY-MM-DD")}\nreminder-repeat: every week when done\n---\n`);
await mk(D + "R3 snooze.md", `---\nreminder: ${b}\nreminder-repeat: every month\n---\n`);
await mk(D + "R4 skip.md", `---\nreminder: ${M().add(-5, "days").format(F)}\nreminder-repeat: every day\n---\n`);
await mk(D + "R5 until.md", `---\nreminder: ${b}\nreminder-repeat: every week until ${day(2)}\n---\n`);
await mk(D + "R6 invalid.md", `---\nreminder: ${b}\nreminder-repeat: now and then\n---\n`);
await mk(D + "R7 readonly.md", `---\nfollow-up: ${b}\nfollow-up-repeat: every month\n---\n`);
await mk(D + "R8 dateweekly.md", `---\nreminder: ${day(-1)}\nreminder-repeat: every week\n---\n`);
const names = ["Pay the rent", "R2 whendone", "R3 snooze", "R4 skip", "R5 until", "R6 invalid", "R7 readonly", "R8 dateweekly"];
const ts = {};
for (const n of names) ts[n] = await waitFor(() => toast(n));
ok("all repeat toasts shown", names.every((n) => ts[n]), names.filter((n) => !ts[n]));
const doneOn = async (n) => { tDone(toast(n)); await sleep(1400); };
// R1
await doneOn("Pay the rent");
out.r1 = await fmOf(D + "R1 monthly.md");
ok("R1 Done moves to next month and records the handled time", out.r1 === `reminder: ${base.clone().add(1, "month").format(F)}\nreminder-title: Pay the rent\nreminder-repeat: every month\nreminder-done: ${b}`, out.r1);
ok("R1 next occurrence listed", rems(D).some((r) => r.file === "R1 monthly.md"));
// R2
await doneOn("R2 whendone");
out.r2 = await fmOf(D + "R2 whendone.md");
ok("R2 'when done' counts from today", out.r2.startsWith(`reminder: ${day(7)}\n`), out.r2);
// R3 snooze then done
tSnooze(toast("R3 snooze"), "Tomorrow"); await sleep(1400);
out.r3a = await fmOf(D + "R3 snooze.md");
ok("R3 snooze moves the date and notes the occurrence", out.r3a.includes(`reminder: ${day(1)}T09:00:00`) && out.r3a.includes(`reminder-occurrence: ${b}`), out.r3a);
// make the snoozed one due now by hand is a manual change -> series restarts; instead press Done through the dialog path: service apply
const r3 = p.reminders.reminders.find((r) => r.file.endsWith("R3 snooze.md"));
out.r3apply = await p._noteReminders.apply(r3, { type: "done", expected: r3.time, now: r3.time.constructor.now ? r3.time.constructor.now() : r3.time });
await sleep(1200);
out.r3b = await fmOf(D + "R3 snooze.md");
ok("R3 Done after a snooze continues from the original occurrence", out.r3b.includes(`reminder: ${base.clone().add(1, "month").format(F)}`) && !out.r3b.includes("reminder-occurrence"), out.r3b);
// R4
await doneOn("R4 skip");
out.r4 = await fmOf(D + "R4 skip.md");
const r4next = M(/reminder: (\S+)/.exec(out.r4)[1]);
ok("R4 past occurrences are skipped", r4next.isAfter(M()) && r4next.diff(M(), "hours") <= 24, out.r4);
// R5
await doneOn("R5 until");
out.r5 = await fmOf(D + "R5 until.md");
ok("R5 no occurrence left before 'until': just done", out.r5.includes(`reminder: ${b}`) && out.r5.includes(`reminder-done: ${b}`), out.r5);
// R6
await doneOn("R6 invalid");
out.r6 = await fmOf(D + "R6 invalid.md"); out.r6notices = notices();
ok("R6 unreadable rule: Done completes", out.r6.includes(`reminder: ${b}`) && out.r6.includes(`reminder-done: ${b}`), out.r6);
ok("R6 a notice says it will not repeat", out.r6notices.length > 0, out.r6notices);
// R7
await doneOn("R7 readonly");
out.r7 = await fmOf(D + "R7 readonly.md");
ok("R7 -repeat is ignored on a read-only property", out.r7 === `follow-up: ${b}\nfollow-up-repeat: every month\nfollow-up-done: ${b}`, out.r7);
// R8
await doneOn("R8 dateweekly");
out.r8 = await fmOf(D + "R8 dateweekly.md");
ok("R8 date-only weekly stays a date", out.r8 === `reminder: ${day(6)}\nreminder-repeat: every week\nreminder-done: ${day(-1)}`, out.r8);
return finish();
