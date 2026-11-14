closeToasts();
await rm("QA/prop");
setSetting("excludedPaths", "");
setSetting("noteReminderSources", [{ property: "follow-up", managed: false, since: "" }]);
const D = "QA/prop/";
const yest = day(-1), tom = day(1);
await mk(D + "S1 date.md", `---\nfollow-up: ${yest}\n---\n`);
await mk(D + "S2 dt30.md", `---\nfollow-up: ${at(-2)}\n---\n`);
await mk(D + "S3 dtTomorrow.md", `---\nfollow-up: ${at(-2)}\n---\n`);
await mk(D + "S4 stale.md", `---\nfollow-up: ${at(-2)}\n---\n`);
await mk(D + "S5 collision.md", `---\nfollow-up: ${yest}\nfollow-up-done: true\n---\n`);
await mk(D + "S6 staleSnooze.md", `---\nfollow-up: ${at(-2)}\n---\n`);
await mk(D + "S7 deleted.md", `---\nfollow-up: ${at(-2)}\n---\n`);
const t1 = await waitFor(() => toast("S1 date"));
const t2 = await waitFor(() => toast("S2 dt30"));
const t3 = await waitFor(() => toast("S3 dtTomorrow"));
const t4 = await waitFor(() => toast("S4 stale"));
const t5 = await waitFor(() => toast("S5 collision"));
const t6 = await waitFor(() => toast("S6 staleSnooze"));
const t7 = await waitFor(() => toast("S7 deleted"));
ok("all toasts shown", t1 && t2 && t3 && t4 && t5 && t6 && t7, [!!t1, !!t2, !!t3, !!t4, !!t5, !!t6, !!t7]);
// S1 date-only tomorrow
tSnooze(t1, "Tomorrow"); await sleep(1500);
out.s1 = await fmOf(D + "S1 date.md");
ok("S1 date snoozed to tomorrow stays a date", out.s1 === `follow-up: ${tom}`, out.s1);
// S2 30 minutes
const want30 = M().add(30, "minutes");
tSnooze(t2, "In 30 minutes"); await sleep(1500);
out.s2 = await fmOf(D + "S2 dt30.md");
const got30 = M(out.s2.replace("follow-up: ", ""));
ok("S2 datetime snoozed 30 minutes", /^follow-up: \d{4}-\d\d-\d\dT\d\d:\d\d:00$/.test(out.s2) && Math.abs(got30.diff(want30, "minutes")) <= 1, out.s2);
ok("S2 still listed at the new time, toast closed", rems(D).some((r) => r.file === "S2 dt30.md") && !toast("S2 dt30"));
// S3 tomorrow on datetime -> reminder time
tSnooze(t3, "Tomorrow"); await sleep(1500);
out.s3 = await fmOf(D + "S3 dtTomorrow.md");
ok("S3 datetime snoozed to tomorrow at reminder time", out.s3 === `follow-up: ${tom}T09:00:00`, out.s3);
// S4 stale Done
const moved = at(-1);
await mk(D + "S4 stale.md", `---\nfollow-up: ${moved}\n---\n`);
await sleep(800);
if (toast("S4 stale") === t4 || document.contains(t4)) { tDone(t4); await sleep(1500); }
out.s4 = await fmOf(D + "S4 stale.md"); out.s4toastStillSame = document.contains(t4);
ok("S4 Done on a notification for an old value writes nothing", out.s4 === `follow-up: ${moved}`, out.s4);
// S6 stale snooze
await mk(D + "S6 staleSnooze.md", `---\nfollow-up: ${moved}\n---\n`);
await sleep(800);
if (document.contains(t6)) { tSnooze(t6, "In 1 hour"); await sleep(1500); }
out.s6 = await fmOf(D + "S6 staleSnooze.md"); out.s6toastStillSame = document.contains(t6);
ok("S6 snooze on a notification for an old value writes nothing", out.s6 === `follow-up: ${moved}`, out.s6);
// S5 collision
const before5 = await read(D + "S5 collision.md");
tDone(t5); await sleep(1500);
out.s5notices = notices();
ok("S5 Done with a foreign -done leaves the note alone", (await read(D + "S5 collision.md")) === before5);
ok("S5 a notice explains", out.s5notices.length > 0, out.s5notices);
// S7 deleted note
await rm(D + "S7 deleted.md"); await sleep(1000);
out.s7toastAfterDelete = document.contains(t7);
ok("S7 reminder gone when the note is deleted", !rems(D).some((r) => r.file === "S7 deleted.md"));
if (document.contains(t7)) { tDone(t7); await sleep(1000); out.s7notices = notices(); }
ok("S7 deleted note is not recreated", !file(D + "S7 deleted.md"));
out.toastsLeft = toasts().map((t) => t.querySelector("h3").textContent);
return finish();
