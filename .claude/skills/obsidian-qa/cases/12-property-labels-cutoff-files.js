closeToasts();
await rm("QA/prop");
const D = "QA/prop/";
const yest = day(-1), tom = day(1);
// two sources -> labels
setSetting("excludedPaths", "QA/prop/excluded/");
setSetting("noteReminderSources", [
  { property: "follow-up", managed: false, since: "" },
  { property: "review", managed: false, since: day(-3) },
]);
await mk(D + "L1 both.md", `---\nfollow-up: ${at(-2)}\nreview: ${at(-3)}\n---\n`);
await mk(D + "C1 before cutoff.md", `---\nreview: ${day(-5)}\n---\n`);
await mk(D + "C2 on cutoff.md", `---\nreview: ${day(-3)}\n---\n`);
await mk(D + "excluded/E1.md", `---\nfollow-up: ${yest}\n---\n`);
await mk(D + "Y1 yaml.md", `---\nfollow-up: ${yest}\nbroken: [unclosed\n---\n`);
await mk(D + "R1 rename.md", `---\nfollow-up: ${tom}\n---\n`);
await mk(D + "M1 mixed.md", `---\nfollow-up: ${at(-2)}\n---\n- [ ] M1 line task (@${M().add(-2, "minutes").format("YYYY-MM-DD HH:mm")})\n`);
await sleep(1500);
const all = rems(D);
out.all = all.map((r) => `${r.file} [${r.origin.kind}:${r.origin.label ?? ""}] ${r.title} @ ${r.time}`);
const l1 = all.filter((r) => r.file === "L1 both.md");
ok("L1 two reminders from two properties", l1.length === 2, l1);
ok("L1 labels are the property names", l1.map((r) => r.origin.label).sort().join() === "follow-up,review", l1);
ok("C1 value before the cut-off is not read", !all.some((r) => r.file === "C1 before cutoff.md"));
ok("C2 value on the cut-off day is read", all.some((r) => r.file === "C2 on cutoff.md"));
ok("E1 excluded folder is not read", !all.some((r) => r.file === "E1.md"));
ok("Y1 invalid YAML gives nothing", !all.some((r) => r.file === "Y1 yaml.md"));
const m1 = all.filter((r) => r.file === "M1 mixed.md");
ok("M1 one note reminder and one line reminder", m1.length === 2 && m1.some((r) => r.origin.kind === "note") && m1.some((r) => r.origin.kind !== "note"), m1);
// toast labels
const tl = await waitFor(() => toasts().filter((t) => t.textContent.includes("L1 both")).length === 2 && toasts().filter((t) => t.textContent.includes("L1 both")));
out.l1Labels = tl && tl.map(tLabel);
ok("L1 toasts show which property", tl && tl.some((t) => tLabel(t).includes("follow-up")) && tl.some((t) => tLabel(t).includes("review")), out.l1Labels);
// Done on one of the two only records that one
if (tl) { tDone(tl.find((t) => tLabel(t).includes("review"))); await sleep(1500); out.l1 = await fmOf(D + "L1 both.md"); ok("L1 Done on review records only review-done", /review-done:/.test(out.l1) && !/follow-up-done/.test(out.l1), out.l1); ok("L1 the other one still pending", rems(D).filter((r) => r.file === "L1 both.md").length === 1); }
// YAML fixed
await mk(D + "Y1 yaml.md", `---\nfollow-up: ${yest}\n---\n`); await sleep(1200);
ok("Y1 back when the YAML is valid", rems(D).some((r) => r.file === "Y1 yaml.md"));
// rename
await app.fileManager.renameFile(file(D + "R1 rename.md"), D + "R1 renamed.md"); await sleep(1500);
const r1 = rems(D).filter((r) => r.file.startsWith("R1"));
ok("R1 reminder follows a rename", r1.length === 1 && r1[0].file === "R1 renamed.md" && r1[0].title === "R1 renamed", r1);
// move into excluded folder
await app.fileManager.renameFile(file(D + "R1 renamed.md"), D + "excluded/R1 renamed.md"); await sleep(1500);
ok("R1 moved into an excluded folder is dropped", !rems(D).some((r) => r.file.startsWith("R1")), rems(D).filter((r) => r.file.startsWith("R1")));
// mixed: Done on the line reminder
const tm = await waitFor(() => toasts().filter((t) => t.textContent.includes("M1")).length === 2 && toasts().filter((t) => t.textContent.includes("M1")));
out.m1Toasts = tm && tm.map((t) => t.querySelector("h3").textContent + " | " + (tLabel(t) ?? ""));
if (tm) {
  const lineT = tm.find((t) => t.querySelector("h3").textContent.includes("line task"));
  tDone(lineT); await sleep(1500);
  out.m1a = await read(D + "M1 mixed.md");
  ok("M1 Done on the line checks the box and leaves the properties", /- \[x\] M1 line task/.test(out.m1a) && !/follow-up-done/.test(out.m1a), out.m1a);
  const noteT = toasts().find((t) => t.textContent.includes("M1 mixed") && !t.querySelector("h3").textContent.includes("line task"));
  ok("M1 note toast still open", noteT);
  if (noteT) { tDone(noteT); await sleep(1500); out.m1b = await read(D + "M1 mixed.md"); ok("M1 Done on the note records -done and keeps the body", /follow-up-done:/.test(out.m1b) && /- \[x\] M1 line task/.test(out.m1b), out.m1b); }
}
// reminder list view
app.commands.executeCommandById("obsidian-reminder-plugin:show-reminders"); await sleep(1500);
const view = document.querySelector(".workspace-leaf-content[data-type*='reminder']");
out.viewType = view?.getAttribute("data-type");
out.viewText = view?.querySelector(".view-content")?.innerText.slice(0, 1500);
return finish();
