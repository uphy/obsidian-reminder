document.querySelector("#qa-settings")?.remove();
closeToasts();
const D = "QA/look/";
// F1: persistence across a plugin reload: handled stays handled, pending stays pending
const acme = p.reminders.reminders.find((r) => r.file.endsWith("Acme Corp.md") && r.origin.kind === "note");
out.acmeDone = acme ? await p._noteReminders.apply(acme, { type: "done", expected: acme.time, now: acme.time }) : "not pending";
await sleep(1500);
const before = rems(D).map((r) => r.file + "|" + r.title + "|" + r.time).sort();
p._data.changed = true; await p._data.save(true);
await app.plugins.disablePlugin("obsidian-reminder-plugin"); await app.plugins.enablePlugin("obsidian-reminder-plugin"); await sleep(2500);
const q = app.plugins.plugins["obsidian-reminder-plugin"];
const after = q.reminders.reminders.filter((r) => r.file.includes(D)).map((r) => r.file.split("/").pop() + "|" + r.title + "|" + r.time.toString()).sort();
ok("F1 same reminders after a reload", JSON.stringify(before) === JSON.stringify(after), [before, after]);
ok("F1 handled note reminder stays handled", !after.some((x) => x.startsWith("Acme Corp.md|Acme Corp|")), after);
// F2: system notification
const n = q.ui.reminderNotifier.systemNotifier;
out.sysAvailable = n.isAvailable();
q.settings.useSystemNotification.rawValue.value = true; await sleep(300);
await mk(D + "Sys.md", `---\nfollow-up: ${at(-1)}\nreminder: ${at(-1)}\nreminder-title: Water the plants\n---\n`);
const got = await waitFor(() => [...n.systemNotifications.values()].length >= 2 && [...n.systemNotifications.values()], 15000);
out.sys = got && got.map((x) => { const o = x.notification ?? x; return { title: o.title, body: o.body, keys: Object.keys(x) }; });
out.sysKeys = [...n.systemNotifications.keys()];
q.settings.useSystemNotification.rawValue.value = false;
return { failed: results.filter((r) => !r.pass), passed: results.filter((r) => r.pass).map((r) => r.name), extra: out };
