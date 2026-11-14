closeToasts();
const D = "QA/bell/";
await rm("QA/bell");
setSetting("excludedPaths", "QA/bell/excluded/");
setSetting("noteReminderHeaderBell", true);
setSetting("noteReminderSources", [{ property: "reminder", managed: true, since: day(-2) }, { property: "follow-up", managed: false, since: "" }]);
await mk(D + "none.md", "x\n");
await mk(D + "waiting.md", `---\nreminder: ${day(1)}\n---\n`);
await mk(D + "done.md", `---\nreminder: ${day(1)}\nreminder-done: ${day(1)}\n---\n`);
await mk(D + "cutoff.md", `---\nreminder: ${day(-9)}\n---\n`);
await mk(D + "readonly.md", `---\nfollow-up: ${day(1)}\n---\n`);
await mk(D + "excluded/ex.md", `---\nreminder: ${day(1)}\n---\n`);
const bell = () => document.querySelector(".workspace-leaf.mod-active .reminder-note-indicator");
const state = async (n) => { await app.workspace.getLeaf(false).openFile(file(D + n + ".md")); await sleep(700); const b = bell(); return b ? { cls: b.className.replace("clickable-icon view-action reminder-note-indicator", "").trim(), icon: b.querySelector("svg")?.getAttribute("class"), label: b.getAttribute("aria-label"), shown: b.style.display !== "none" && b.offsetParent !== null } : null; };
for (const n of ["none", "waiting", "done", "cutoff", "readonly", "excluded/ex"]) out[n] = await state(n);
ok("bell: none = idle with plus", out.none?.icon.includes("plus"), out.none);
ok("bell: waiting = ringing", out.waiting && !out.waiting.cls.includes("is-idle") && out.waiting.icon.includes("ring"), out.waiting);
ok("bell: done = faint without plus", out.done?.cls.includes("is-idle") && !out.done.icon.includes("plus"), out.done);
ok("bell: before the cut-off = faint without plus", out.cutoff?.cls.includes("is-idle") && !out.cutoff.icon.includes("plus"), out.cutoff);
ok("bell: excluded note has no usable bell", !out["excluded/ex"] || !out["excluded/ex"].shown, out["excluded/ex"]);
// command availability in excluded
const cmd = app.commands.commands["obsidian-reminder-plugin:set-note-reminder"];
out.cmdKeys = Object.keys(cmd);
const check = cmd.checkCallback ?? cmd.editorCheckCallback;
out.cmdInExcluded = check ? check(true) : "no check";
ok("command unavailable in an excluded note", out.cmdInExcluded === false, out.cmdInExcluded);
await app.workspace.getLeaf(false).openFile(file(D + "none.md")); await sleep(500);
ok("command available in a normal note", check && check(true) === true);
// file menu
const titles = (f) => { const got = []; const item = () => new Proxy({}, { get: (_t, k) => (k === "setTitle" ? function (t) { got.push(typeof t === "string" ? t : t.textContent); return this; } : function () { return this; }) }); const m = new Proxy({}, { get: (_t, k) => (k === "addItem" ? function (cb) { cb(item()); return this; } : function () { return this; }) }); try { app.workspace.trigger("file-menu", m, f, "file-explorer"); } catch (e) { got.push("ERR " + e); } return got; };
out.menuNone = titles(file(D + "none.md")).filter((t) => /reminder/i.test(t));
out.menuWaiting = titles(file(D + "waiting.md")).filter((t) => /reminder/i.test(t));
out.menuExcluded = titles(file(D + "excluded/ex.md")).filter((t) => /reminder/i.test(t));
ok("file menu: 'Set reminder' on a note without one", out.menuNone.length === 1 && /^Set /.test(out.menuNone[0]), out.menuNone);
ok("file menu: 'Edit' on a note with one", out.menuWaiting.length === 1 && /^Edit /.test(out.menuWaiting[0]), out.menuWaiting);
ok("file menu: nothing on an excluded note", out.menuExcluded.length === 0, out.menuExcluded);
// header bell off: shown only while waiting
setSetting("noteReminderHeaderBell", false); await sleep(300);
for (const n of ["none", "waiting", "done"]) out["off_" + n] = await state(n);
ok("bell off: hidden without a waiting reminder", (!out.off_none || !out.off_none.shown) && (!out.off_done || !out.off_done.shown), [out.off_none, out.off_done]);
ok("bell off: still shown while waiting", out.off_waiting?.shown, out.off_waiting);
setSetting("noteReminderHeaderBell", true);
// read-only only source: dialog on a readonly note with managed property existing
await state("readonly");
out.readonlyBell = out.readonly;
return finish();
