const D = "QA/managed/";
const P = D + "B1 first.md";
const dlg = () => document.querySelector(".note-reminder-editor");
const bell = () => document.querySelector(".workspace-leaf.mod-active .reminder-note-indicator");
const inputs = () => [...dlg().querySelectorAll('input[type="text"]')];
const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); };
const btns = () => [...dlg().querySelectorAll("button")].filter((b) => !b.classList.contains("calendar-date") && !b.classList.contains("month-nav")).map((b) => b.textContent.trim() || b.getAttribute("aria-label"));
const btn = (text) => [...dlg().querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const okBtn = () => dlg().querySelector(".dtchooser-wrapper button.mod-cta");
const pickDay = (n) => [...dlg().querySelectorAll("button.calendar-date:not(.other-month)")].find((b) => b.textContent.trim() === String(n)).click();
const timeToggle = () => dlg().querySelector(".dtchooser-time-toggle");
const setTime = (v) => { const tp = dlg().querySelector("select.time-picker"); tp.dispatchEvent(new Event("focus")); tp.value = v; tp.dispatchEvent(new Event("change", { bubbles: true })); };
const open = async () => { app.commands.executeCommandById("obsidian-reminder-plugin:set-note-reminder"); await sleep(900); };
if (!dlg()) await open();
out.newButtons = btns();
out.timeCheckedInitially = timeToggle().checked;
out.timeInitially = dlg().querySelector("select.time-picker").value;
// B2 new reminder with time and title
setv(inputs()[0], "Send the report");
const target = M().add(1, "days");
if (target.month() !== M().month()) { dlg().querySelectorAll(".month-nav")[1].click(); await sleep(300); }
pickDay(target.date()); await sleep(200);
out.afterPickChecked = timeToggle().checked;
setTime("08:00"); await sleep(200);
out.afterTimeChecked = timeToggle().checked;
okBtn().click(); await sleep(1500);
out.b2 = await fmOf(P);
ok("B2 dialog writes reminder with time and title", out.b2 === `reminder: ${target.format("YYYY-MM-DD")}T08:00:00\nreminder-title: Send the report`, out.b2);
ok("B2 body is kept", (await read(P)).endsWith("# B1\nbody\n"));
const r = rems(D)[0];
ok("B2 listed with the title from -title", r && r.title === "Send the report" && r.time === target.format("YYYY-MM-DD") + " 08:00", r);
await sleep(500);
ok("B3 bell is ringing while waiting", bell() && !bell().classList.contains("is-idle"), bell()?.className);
out.bellWaiting = bell()?.className + " | " + bell()?.getAttribute("aria-label");
// B4 edit: reopen shows the values, extra buttons
bell().click(); await sleep(900);
out.editButtons = btns();
out.editValues = inputs().map((i) => i.value);
ok("B4 edit dialog shows the saved title", inputs()[0].value === "Send the report", out.editValues);
ok("B4 edit dialog shows the saved time", timeToggle().checked && dlg().querySelector("select.time-picker").value === "08:00", [timeToggle().checked, dlg().querySelector("select.time-picker").value]);
// B5 untick time -> date only, clear the title
timeToggle().click(); await sleep(200);
setv(inputs()[0], "");
okBtn().click(); await sleep(1500);
out.b5 = await fmOf(P);
ok("B5 unticked time saves a date; emptied title is removed", out.b5 === `reminder: ${target.format("YYYY-MM-DD")}`, out.b5);
ok("B5 title falls back to the note name", rems(D)[0]?.title === "B1 first", rems(D)[0]);
return finish();
