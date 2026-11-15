document.querySelector("#qa-settings")?.remove();
closeToasts();
await rm("QA/prop");
setSetting("excludedPaths", "");
setSetting("noteReminderSources", [{ property: "follow-up", managed: false, since: "" }]);
const D = "QA/prop/";
const yest = day(-1), past = at(-3), tom = day(1);
// A1 date-only
await mk(D + "A1 date.md", `---\nfollow-up: ${yest}\n---\nbody\n`);
// A2 datetime
await mk(D + "A2 datetime.md", `---\nfollow-up: ${past}\n---\nbody\n`);
// A3 space format
await mk(D + "A3 space.md", `---\nfollow-up: ${M().add(-4, "minutes").format("YYYY-MM-DD HH:mm")}\n---\nbody\n`);
// A4 ignored values
await mk(D + "A4 text.md", `---\nfollow-up: soon\n---\n`);
await mk(D + "A4 number.md", `---\nfollow-up: 20261120\n---\n`);
await mk(D + "A4 list.md", `---\nfollow-up:\n  - ${yest}\n---\n`);
await mk(D + "A4 offset.md", `---\nfollow-up: ${M().add(-5, "minutes").format("YYYY-MM-DDTHH:mm:ssZ")}\n---\n`);
await mk(D + "A4 zulu.md", `---\nfollow-up: ${M().add(-5, "minutes").utc().format("YYYY-MM-DDTHH:mm:ss")}Z\n---\n`);
await mk(D + "A4 empty.md", `---\nfollow-up:\n---\n`);
await mk(D + "A4 nofm.md", `follow-up: ${yest}\n`);
// A19 future
await mk(D + "A19 future.md", `---\nfollow-up: ${tom}\n---\n`);
// A21 quoted
await mk(D + "A21 quoted.md", `---\nfollow-up: "${yest}"\n---\n`);
await sleep(1500);
const all = rems(D);
out.all = all.map((r) => r.file + " @ " + r.time);
const names = all.map((r) => r.file);
ok("A1 date-only read at reminder time", all.find((r) => r.file === "A1 date.md")?.time === yest + " 09:00" || all.find((r) => r.file === "A1 date.md")?.time === yest, all.find((r) => r.file === "A1 date.md"));
ok("A2 datetime read", names.includes("A2 datetime.md"));
ok("A3 space format read", names.includes("A3 space.md"));
for (const n of ["text", "number", "list", "offset", "zulu", "empty", "nofm"]) ok("A4 ignored: " + n, !names.includes(`A4 ${n}.md`));
ok("A19 future listed", names.includes("A19 future.md"));
ok("A21 quoted date read", names.includes("A21 quoted.md"));
ok("label empty with one source", all.every((r) => r.origin.label === ""));

// toasts
const t1 = await waitFor(() => toast("A1 date"));
const t2 = await waitFor(() => toast("A2 datetime"));
ok("A1 toast shown", t1); ok("A2 toast shown", t2);
ok("A19 future has no toast", !toast("A19 future"));
ok("toast has no label when one source", t1 && !/follow-up/.test(tLabel(t1)), t1 && tLabel(t1));
out.a1Options = t1 && tOptions(t1);
out.a2Options = t2 && tOptions(t2);
ok("A6 date-only offers whole-day options only", t1 && tOptions(t1).join() === "Tomorrow,Next week", out.a1Options);
ok("A7 datetime offers all options", t2 && tOptions(t2).length === 5, out.a2Options);

// A1 Done
tDone(t1); await sleep(1500);
out.a1 = await fmOf(D + "A1 date.md");
ok("A1 Done writes -done as a date, keeps the date", out.a1 === `follow-up: ${yest}\nfollow-up-done: ${yest}`, out.a1);
ok("A1 reminder gone after Done", !rems(D).some((r) => r.file === "A1 date.md"));
ok("A1 toast closed", !toast("A1 date"));
// A2 Done
tDone(t2); await sleep(1500);
out.a2 = await fmOf(D + "A2 datetime.md");
ok("A2 Done writes -done as date and time", out.a2 === `follow-up: ${past}\nfollow-up-done: ${past}`, out.a2);
// A5 next date -> pending again
await mk(D + "A1 date.md", `---\nfollow-up: ${day(0)}\nfollow-up-done: ${yest}\n---\nbody\n`);
await sleep(1200);
ok("A5 new date after Done is pending again", rems(D).some((r) => r.file === "A1 date.md"), rems(D));
// A15 same date -> not pending
await mk(D + "A15 handled.md", `---\nfollow-up: ${yest}\nfollow-up-done: ${yest}\n---\n`);
await sleep(1200);
ok("A15 handled value is not pending", !rems(D).some((r) => r.file === "A15 handled.md"));
// A16 mute
const t3 = await waitFor(() => toast("A3 space"));
ok("A3 toast shown", t3);
const before3 = await read(D + "A3 space.md");
tMute(t3); await sleep(1200);
ok("A16 mute writes nothing", (await read(D + "A3 space.md")) === before3);
ok("A16 mute closes the toast, reminder stays", !toast("A3 space") && rems(D).some((r) => r.file === "A3 space.md"));
// A21 toast and done on quoted
const t21 = await waitFor(() => toast("A21 quoted"));
ok("A21 toast shown", t21);
if (t21) { tDone(t21); await sleep(1500); out.a21 = await fmOf(D + "A21 quoted.md"); ok("A21 Done on quoted value", /follow-up-done: "?\d{4}-\d\d-\d\d"?$/.test(out.a21), out.a21); }
out.notices = notices();
return finish();
