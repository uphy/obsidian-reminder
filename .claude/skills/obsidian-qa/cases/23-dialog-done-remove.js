const D = "QA/managed/";
const P = D + "B1 first.md";
const dlg = () => document.querySelector(".note-reminder-editor");
const bell = () => document.querySelector(".workspace-leaf.mod-active .reminder-note-indicator");
const inputs = () => [...dlg().querySelectorAll('input[type="text"]')];
const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
const btns = () => [...dlg().querySelectorAll("button")].filter((b) => !b.classList.contains("calendar-date") && !b.classList.contains("month-nav")).map((b) => b.textContent.trim() || b.getAttribute("aria-label"));
const btn = (text) => [...dlg().querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const okBtn = () => dlg().querySelector(".dtchooser-wrapper button.mod-cta");
const open = async () => { bell().click(); await sleep(900); };
const tom = day(1);
// Mark as done from the dialog
await open();
btn("Mark as Done").click(); await sleep(1500);
out.done = await fmOf(P);
ok("B6 'Mark as Done' in the dialog records -done", out.done === `reminder: ${tom}\nreminder-done: ${tom}`, out.done);
ok("B6 not pending", rems(D).length === 0, rems(D));
out.bellDone = bell()?.className + " | " + bell()?.getAttribute("aria-label");
ok("B6 bell is faint, without a plus, when done", bell()?.classList.contains("is-idle") && !bell().querySelector("svg")?.getAttribute("class").includes("plus"), out.bellDone);
// Remind again
await open();
out.doneButtons = btns();
const again = btn("Remind again") ?? [...dlg().querySelectorAll("button")].find((b) => /Remind again/.test(b.textContent));
ok("B7 dialog offers 'Remind again' on a done reminder", again, out.doneButtons);
if (again) { again.click(); await sleep(1500); out.again = await fmOf(P); ok("B7 'Remind again' removes -done", out.again === `reminder: ${tom}`, out.again); ok("B7 pending again", rems(D).length === 1); }
// add title + repeat then remove
if (dlg()) { dlg().closest(".modal-container")?.querySelector(".modal-close-button, .modal-header-button")?.click(); await sleep(400); }
await open();
setv(inputs()[0], "T"); setv(inputs()[1], "every week"); await sleep(200);
okBtn().click(); await sleep(1500);
out.withRepeat = await fmOf(P);
ok("B8 repeat rule saved in -repeat", /reminder-repeat: every week/.test(out.withRepeat) && /reminder-title: T/.test(out.withRepeat), out.withRepeat);
await open();
btn("Remove reminder").click(); await sleep(1500);
out.removed = await read(P);
out.removeModal = document.querySelector(".modal-container .modal")?.innerText.slice(0, 300);
ok("B9 'Remove reminder' removes every property it wrote", !/reminder/.test(out.removed), out.removed);
out.bellRemoved = bell()?.className;
ok("B9 bell back to idle", bell()?.classList.contains("is-idle"), out.bellRemoved);
return finish();
