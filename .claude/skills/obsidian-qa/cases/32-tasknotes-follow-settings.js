closeToasts();
setSetting("excludedPaths", ""); setSetting("noteReminderSources", []); setSetting("taskNotesSince", ""); setSetting("taskNotesEnabled", true);
const D = "QA/tn2/";
await rm("QA/tn"); await rm("QA/tn2");
const tn = app.plugins.plugins.tasknotes;
const defaults = () => { p.taskNotesDefaultsCache = undefined; return p.taskNotesDefaults(); };
const F = "YYYY-MM-DDTHH:mm";
const past = M().add(-3, "minutes").format("YYYY-MM-DDTHH:mm:00");
// V1: follow TaskNotes' renamed properties, live
const fmOrig = JSON.parse(JSON.stringify(tn.settings.fieldMapping));
const statusesOrig = JSON.parse(JSON.stringify(tn.settings.customStatuses));
const idOrig = { m: tn.settings.taskIdentificationMethod, n: tn.settings.taskPropertyName, v: tn.settings.taskPropertyValue, tag: tn.settings.taskTag };
out.tnSettingKeys = Object.keys(tn.settings).filter((k) => /task(Tag|Ident|Property)|fieldMapping|customStatuses/.test(k));
try {
  tn.settings.fieldMapping.due = "deadline";
  tn.settings.fieldMapping.reminders = "alerts";
  tn.settings.fieldMapping.title = "name";
  tn.settings.fieldMapping.status = "state";
  const d1 = defaults();
  out.v1source = d1.source; out.v1props = d1.settings.properties;
  ok("V1 defaults follow the running TaskNotes", d1.source === "tasknotes" && d1.settings.properties.due === "deadline" && d1.settings.properties.reminders === "alerts", d1);
  const dueT = M().add(10, "minutes").format(F);
  await mk(D + "V1.md", `---\nname: V1 renamed\nstate: open\ntags:\n  - task\ndeadline: ${dueT}\nalerts:\n  - id: rem_1\n    type: relative\n    relatedTo: due\n    offset: -PT15M\n---\n`);
  await mk(D + "V1old.md", `---\ntitle: V1 old names\nstatus: open\ntags:\n  - task\ndue: ${dueT}\nreminders:\n  - id: rem_1\n    type: relative\n    relatedTo: due\n    offset: -PT15M\n---\n`);
  await mk(D + "V1done.md", `---\nname: V1 done state\nstate: done\ntags:\n  - task\nalerts:\n  - id: rem_1\n    type: absolute\n    absoluteTime: ${past}\n---\n`);
  await sleep(1800);
  const r = rems(D);
  out.v1 = r.map((x) => x.file + " | " + x.title + " @ " + x.time);
  ok("V1 renamed properties are read", r.some((x) => x.file === "V1.md" && x.title === "V1 renamed"), out.v1);
  ok("V1 a note with the old names is not read", !r.some((x) => x.file === "V1old.md"), out.v1);
  ok("V1 completed under the renamed status is skipped", !r.some((x) => x.file === "V1done.md"), out.v1);
  const t = await waitFor(() => toast("V1 renamed"));
  ok("V1 toast", t);
  if (t) { tDone(t); await sleep(1500); out.v1fm = await fmOf(D + "V1.md"); ok("V1 Done records under the renamed name (alerts-done)", /alerts-done:\n  - rem_1@/.test(out.v1fm) && !/reminders-done/.test(out.v1fm), out.v1fm); }
  // V2: override here wins over TaskNotes
  s.taskNotesPropertyNames.due.rawValue.value = "due";
  s.taskNotesPropertyNames.reminders.rawValue.value = "reminders";
  s.taskNotesPropertyNames.title.rawValue.value = "title";
  s.taskNotesPropertyNames.status.rawValue.value = "status";
  await rescan();
  const r2 = rems(D);
  out.v2 = r2.map((x) => x.file + " | " + x.title);
  ok("V2 a name filled in here wins over TaskNotes", r2.some((x) => x.file === "V1old.md" && x.title === "V1 old names") && !r2.some((x) => x.file === "V1.md"), out.v2);
} finally {
  tn.settings.fieldMapping = fmOrig;
  for (const k of ["due", "reminders", "title", "status"]) s.taskNotesPropertyNames[k].rawValue.value = "";
}
// V3: identification by property, from TaskNotes
try {
  tn.settings.taskIdentificationMethod = "property"; tn.settings.taskPropertyName = "type"; tn.settings.taskPropertyValue = "task";
  const d = defaults();
  out.v3 = { id: d.settings.identification, prop: d.settings.taskProperty, val: d.settings.taskPropertyValue };
  await mk(D + "V3prop.md", `---\ntitle: V3 by property\ntype: task\nstatus: open\nreminders:\n  - id: rem_1\n    type: absolute\n    absoluteTime: ${at(60)}\n---\n`);
  await mk(D + "V3tag.md", `---\ntitle: V3 by tag\ntags:\n  - task\nstatus: open\nreminders:\n  - id: rem_1\n    type: absolute\n    absoluteTime: ${at(60)}\n---\n`);
  await mk(D + "V3other.md", `---\ntitle: V3 other value\ntype: note\nstatus: open\nreminders:\n  - id: rem_1\n    type: absolute\n    absoluteTime: ${at(60)}\n---\n`);
  await rescan();
  const r3 = rems(D).map((x) => x.file);
  out.v3files = r3;
  ok("V3 identification by property follows TaskNotes", r3.includes("V3prop.md") && !r3.includes("V3tag.md") && !r3.includes("V3other.md"), r3);
  // override: identify by tag here
  setSetting("taskNotesIdentification", "tag"); await rescan();
  const r4 = rems(D).map((x) => x.file);
  ok("V3 'Identify tasks by: tag' here overrides TaskNotes", r4.includes("V3tag.md") && !r4.includes("V3prop.md"), r4);
} finally {
  tn.settings.taskIdentificationMethod = idOrig.m; tn.settings.taskPropertyName = idOrig.n; tn.settings.taskPropertyValue = idOrig.v;
  setSetting("taskNotesIdentification", "auto");
}
// V4: custom completed status from TaskNotes
try {
  tn.settings.customStatuses = [...statusesOrig, { id: "x", value: "shipped", label: "Shipped", color: "#000", isCompleted: true, order: 99 }];
  defaults();
  await mk(D + "V4.md", `---\ntitle: V4 shipped\ntags:\n  - task\nstatus: shipped\nreminders:\n  - id: rem_1\n    type: absolute\n    absoluteTime: ${at(60)}\n---\n`);
  await rescan();
  ok("V4 a custom completed status of TaskNotes is skipped", !rems(D).some((x) => x.file === "V4.md"));
} finally { tn.settings.customStatuses = statusesOrig; }
defaults(); await rescan();
ok("V4 the same note is read once that status is gone", rems(D).some((x) => x.file === "V4.md"), rems(D).map((x) => x.file));
// TaskNotes keeps parts of its settings in objects of its own, so setting
// the fields back is not enough: reload it, or it goes on writing the
// renamed properties.
await app.plugins.disablePlugin("tasknotes"); await app.plugins.enablePlugin("tasknotes"); await sleep(3000);
out.restored = { due: app.plugins.plugins.tasknotes.settings.fieldMapping.due, method: app.plugins.plugins.tasknotes.settings.taskIdentificationMethod };
return finish();
