// Prepended to every case by qa-run.sh. A case is the body of an async
// function: it can `await`, and what it returns is printed. Return
// `finish()` to report the checks made with `ok()`.
const p = app.plugins.plugins["obsidian-reminder-plugin"];
const s = p.settings;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The settings as they were before the first case of this QA run, kept in
// localStorage so they survive plugin and window reloads. 99-end.js puts
// them back.
const SNAPSHOT_KEY = "obsidian-reminder-qa-snapshot";
const settingKeys = () => Object.keys(s).filter((k) => s[k] && s[k].rawValue !== undefined);
if (localStorage.getItem(SNAPSHOT_KEY) == null) {
  const snapshot = { settings: {}, names: {} };
  for (const k of settingKeys()) snapshot.settings[k] = s[k].rawValue.value;
  for (const k of Object.keys(s.taskNotesPropertyNames ?? {})) snapshot.names[k] = s.taskNotesPropertyNames[k].rawValue.value;
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}
// `qa-run.sh --step NAME[@LANGUAGE]`: the step of a case that does one step
// per call, and the plugin's UI language for this call. The checks click
// buttons by their English labels, so the language is English unless a
// step asks for another one (the display tour).
const [STEP, LANG = "en"] = String(window.__step ?? "").split("@");
if (s.language.rawValue.value !== LANG) { s.language.rawValue.value = LANG; await sleep(600); }
const file = (path) => app.vault.getAbstractFileByPath(path);
const read = async (path) => app.vault.read(file(path));
const fmOf = async (path) => { const t = await read(path); const m = /^---\n([\s\S]*?)\n---/.exec(t); return m ? m[1] : null; };
const mk = async (path, content) => {
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir && !file(dir)) await app.vault.createFolder(dir);
  const f = file(path);
  if (f) await app.vault.modify(f, content); else await app.vault.create(path, content);
};
const rm = async (path) => { const f = file(path); if (f) await app.vault.delete(f, true); };
const waitFor = async (fn, ms = 12000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(200); } };
const M = window.moment;
const at = (min, fmt = "YYYY-MM-DDTHH:mm:00") => M().add(min, "minutes").format(fmt);
const day = (d) => M().add(d, "days").format("YYYY-MM-DD");
const rems = (pathPart) => p.reminders.reminders.filter((r) => r.file.includes(pathPart)).map((r) => ({ file: r.file.split("/").pop(), title: r.title, time: r.time.toString(), origin: r.origin }));
const toasts = () => [...document.querySelectorAll(".reminder-toast-card")];
const toast = (text) => toasts().find((c) => c.textContent.includes(text));
const closeToasts = () => document.querySelectorAll(".reminder-toast-close").forEach((b) => b.click());
const setSetting = (key, value) => { s[key].rawValue.value = value; };
const rescan = async () => { app.commands.executeCommandById("obsidian-reminder-plugin:scan-reminders"); await sleep(1500); };
const notices = () => [...document.querySelectorAll(".notice")].map((n) => n.textContent);
const out = {};
const results = [];
const ok = (name, cond, detail) => { results.push({ name, pass: !!cond, ...(cond ? {} : { detail }) }); };
const tDone = (t) => t.querySelector(".reminder-actions button.mod-cta").click();
const tMute = (t) => t.querySelectorAll(".reminder-actions button")[1].click();
const tOptions = (t) => [...t.querySelectorAll("select.later-select option")].filter((o) => !o.disabled).map((o) => o.textContent);
const tSnooze = (t, label) => { const sel = t.querySelector("select.later-select"); const o = [...sel.options].find((x) => x.textContent === label); if (!o) throw new Error("no option " + label); sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); };
const tLabel = (t) => t.querySelector(".reminder-note-origin")?.textContent.trim();
const finish = () => ({ failed: results.filter((r) => !r.pass), passed: results.filter((r) => r.pass).map((r) => r.name), extra: out });
