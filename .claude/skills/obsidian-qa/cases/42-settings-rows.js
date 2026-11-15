const m = document.querySelector("#qa-settings .vertical-tab-content");
const rowsOf = (name) => [...m.querySelectorAll(".setting-item")].filter((i) => i.offsetParent && i.querySelector(".setting-item-name")?.textContent === name);
const row = (name) => rowsOf(name)[0];
const type = (input, v) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); };
const src = () => JSON.parse(JSON.stringify(s.noteReminderSources.rawValue.value));
// block controls
out.blockButtons = [...m.querySelectorAll("button, .clickable-icon")].filter((b) => b.offsetParent).map((b) => (b.textContent.trim() || b.getAttribute("aria-label") || b.className)).slice(0, 20);
// managed toggle on the first block (visit)
const managed = rowsOf("Managed");
managed[1].querySelector(".checkbox-container").click(); await sleep(800);
ok("D7 'Managed' toggle turns the property managed", src().find((x) => x.property === "fresh")?.managed === true, src());
// cut-off: move back to read older values
const cut = rowsOf("Ignore dates before");
type(cut[0].querySelector("input"), day(-10));
await waitFor(() => rems("QA/set/").some((r) => r.origin.key === "visit" && r.file === "past2.md"));
ok("D8 moving the cut-off back reads the older value", src()[0].since === day(-10) && rems("QA/set/").filter((r) => r.origin.key === "visit").map((r) => r.file).sort().join() === "future.md,past2.md", [src()[0], rems("QA/set/").map((r) => r.file)]);
// remove 'check'
const removeBtns = [...m.querySelectorAll("button, .clickable-icon")].filter((b) => b.offsetParent && /Remove/.test((b.getAttribute("aria-label") ?? "") + b.textContent + b.innerHTML));
out.removeCount = removeBtns.length;
if (removeBtns.length >= 3) { removeBtns[2].click(); await sleep(1000); const conf = [...document.querySelectorAll(".modal-container:not(#qa-settings) button")].find((b) => /Remove|OK|Yes/.test(b.textContent)); if (conf) { out.confirmText = conf.closest(".modal").innerText.slice(0, 200); conf.click(); await sleep(800); } }
ok("D10 a property can be removed", !src().some((x) => x.property === "check"), src());
// TaskNotes group
const en = row("Read TaskNotes reminders");
out.disabledWhileOff = [...m.querySelectorAll(".setting-item")].filter((i) => i.offsetParent && i.querySelector("input:disabled, select:disabled")).map((i) => i.querySelector(".setting-item-name")?.textContent);
en.querySelector(".checkbox-container").click(); await sleep(1500);
ok("D11 turning reading on sets the cut-off to today", s.taskNotesEnabled.rawValue.value === true && s.taskNotesSince.rawValue.value === day(0), [s.taskNotesEnabled.rawValue.value, s.taskNotesSince.rawValue.value]);
out.disabledWhileOn = [...m.querySelectorAll(".setting-item")].filter((i) => i.offsetParent && i.querySelector("input:disabled, select:disabled")).map((i) => i.querySelector(".setting-item-name")?.textContent);
out.visibleRowsAuto = [...m.querySelectorAll(".setting-item")].filter((i) => i.offsetParent).map((i) => i.querySelector(".setting-item-name")?.textContent).filter((n) => /Task |Completed|Archive/.test(n));
// identification dropdown
const sel = row("Identify tasks by").querySelector("select:not(.is-measuring)");
sel.value = "property"; sel.dispatchEvent(new Event("change", { bubbles: true })); await sleep(1000);
out.afterProperty = { value: s.taskNotesIdentification.rawValue.value, disabled: [...m.querySelectorAll(".setting-item")].filter((i) => i.offsetParent && i.querySelector("input:disabled, select:disabled")).map((i) => i.querySelector(".setting-item-name")?.textContent) };
ok("D12 choosing 'property' is stored", out.afterProperty.value === "property");
const sel2 = row("Identify tasks by").querySelector("select:not(.is-measuring)");
sel2.value = "auto"; sel2.dispatchEvent(new Event("change", { bubbles: true })); await sleep(800);
out.enableRowText = row("Read TaskNotes reminders").innerText;
out.idRowText = row("Identify tasks by").innerText;
return finish();
