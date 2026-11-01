// Reads and operates the macOS system notifications raised by
// obsidian-reminder, through the Accessibility (AX) API of Notification
// Center. Driven by ../system-notification.sh, which compiles this file once
// and caches the binary; run that script rather than this file.
//
// Why AX actions and not buttons: on macOS 26 a notification row in
// Notification Center (and the on-screen banner, which is the same process)
// exposes its buttons -- "Mark as Done", the "Remind me later" items, the
// close button -- as *custom AX actions on the row itself*, not as child
// AXButton elements. Tools that look for child buttons (agent-desktop 1.0.2's
// `notification-action`, for one) find nothing. Performing the row's custom
// action delivers the same event to Electron as a real click: the plugin's
// `action` / `click` / `close` handlers run.
//
// Only rows whose first text is "Obsidian Reminder" (the fixed title the
// plugin gives every system notification, see src/plugin/ui/system-notification.ts)
// are ever printed or touched. Other apps' notifications are personal data and
// are neither read out nor acted on.
//
// Subcommands (exit 0 on success):
//   state                 prints "open" or "closed"
//   open | close          opens / closes Notification Center (no-op if already so)
//   list                  JSON array of {kind, body, actions} for Obsidian Reminder rows
//   act <body> <action>   performs <action> on the row whose body == <body>
//                         exit 3: no such row (yet); exit 4: row has no such action
//   clear-all             closes every Obsidian Reminder row (cleanup after a flood)
//
// <action> is the button label as the plugin sets it ("Mark as Done",
// "In 30 minutes", ...), or one of:
//   click   the notification body (AXPress)
//   close   the close button (labelled in the OS language, e.g. "閉じる")

import AppKit
import ApplicationServices

let reminderTitle = "Obsidian Reminder"
// The close / clear-all buttons are labelled by macOS in the system language.
// Extend these when running under another language.
let closeLabels: Set<String> = ["close", "閉じる"]
let clearAllLabels: Set<String> = ["clear all", "すべて消去"]

func fail(_ message: String, _ code: Int32 = 1) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(code)
}

func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
  var value: AnyObject?
  return AXUIElementCopyAttributeValue(e, name as CFString, &value) == .success ? value : nil
}
func string(_ e: AXUIElement, _ name: String) -> String { (attr(e, name) as? String) ?? "" }
func children(_ e: AXUIElement) -> [AXUIElement] { (attr(e, "AXChildren") as? [AXUIElement]) ?? [] }

/// Raw AX action names. Custom actions look like "Name:Mark as Done\nTarget:0x0\nSelector:(null)".
func rawActions(_ e: AXUIElement) -> [String] {
  var names: CFArray?
  guard AXUIElementCopyActionNames(e, &names) == .success, let list = names as? [String] else { return [] }
  return list
}
func label(_ raw: String) -> String {
  guard let range = raw.range(of: "Name:") else { return raw }
  return String(raw[range.upperBound...].prefix(while: { $0 != "\n" }))
}

func app(_ bundleID: String) -> AXUIElement? {
  guard let running = NSWorkspace.shared.runningApplications.first(where: { $0.bundleIdentifier == bundleID }) else {
    return nil
  }
  return AXUIElementCreateApplication(running.processIdentifier)
}

func notificationCenterWindows() -> [AXUIElement] {
  guard let nc = app("com.apple.notificationcenterui") else { fail("Notification Center process not found") }
  return (attr(nc, "AXWindows") as? [AXUIElement]) ?? []
}

/// Whether the Notification Center panel itself is open. An on-screen banner is
/// also a window of the same process (with the same window / scroll-area
/// shape), so look for elements only the panel has: the notification list
/// container and the "Edit Widgets" button, identified by AXIdentifier.
func centerIsOpen() -> Bool {
  let panelOnly: Set<String> = ["AXNotificationListItems", "widget-editor-button"]
  func search(_ e: AXUIElement, _ depth: Int) -> Bool {
    if depth > 5 { return false }
    if panelOnly.contains(string(e, "AXIdentifier")) { return true }
    if string(e, "AXSubrole").hasPrefix("AXNotificationCenter") { return false }
    return children(e).contains { search($0, depth + 1) }
  }
  return notificationCenterWindows().contains { search($0, 0) }
}

/// Toggles Notification Center by pressing the menu-bar clock, found by its
/// AXIdentifier rather than its (localized) description, so this works in any
/// system language and needs no Automation permission for System Events.
func pressClock() {
  guard let cc = app("com.apple.controlcenter"), let bar = attr(cc, "AXExtrasMenuBar") else {
    fail("menu bar extras of Control Center not found")
  }
  guard let clock = children(bar as! AXUIElement).first(where: { string($0, "AXIdentifier") == "com.apple.menuextra.clock" }) else {
    fail("menu bar clock (com.apple.menuextra.clock) not found")
  }
  AXUIElementPerformAction(clock, "AXPress" as CFString)
}

func setCenter(open: Bool) {
  if centerIsOpen() == open { return }
  pressClock()
  for _ in 0..<30 {
    if centerIsOpen() == open { return }
    usleep(100_000)
  }
  fail("Notification Center did not \(open ? "open" : "close") within 3s")
}

struct Row {
  let element: AXUIElement
  let kind: String  // "banner" or "stack"
  let body: String
  let actions: [String]  // raw AX action names
}

/// Obsidian Reminder rows in the banner and in the open panel, in tree order.
func reminderRows() -> [Row] {
  var rows: [Row] = []
  func walk(_ e: AXUIElement, _ depth: Int) {
    if depth > 12 { return }
    let subrole = string(e, "AXSubrole")
    if subrole == "AXNotificationCenterBanner" || subrole == "AXNotificationCenterBannerStack" {
      let texts = children(e).filter { string($0, "AXRole") == "AXStaticText" }.map { string($0, "AXValue") }
      if texts.count >= 2 && texts[0] == reminderTitle {
        rows.append(Row(element: e, kind: subrole.hasSuffix("Stack") ? "stack" : "banner", body: texts[1], actions: rawActions(e)))
      }
      return
    }
    for child in children(e) { walk(child, depth + 1) }
  }
  for window in notificationCenterWindows() { walk(window, 0) }
  return rows
}

func rawAction(for wanted: String, in row: Row) -> String? {
  let lower = wanted.lowercased()
  if lower == "click" { return row.actions.first { $0 == "AXPress" } }
  if lower == "close" {
    let labels = row.kind == "stack" ? clearAllLabels : closeLabels
    return row.actions.first { labels.contains(label($0).lowercased()) }
  }
  return row.actions.first { label($0).lowercased() == lower }
}

func perform(_ raw: String, on row: Row) -> Bool {
  AXUIElementPerformAction(row.element, raw as CFString) == .success
}

func json(_ value: Any) -> String {
  let data = try! JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
  return String(data: data, encoding: .utf8)!
}

if !AXIsProcessTrusted() {
  fail("""
    Accessibility permission is missing for the app running this script (your terminal or IDE).
    Grant it in System Settings > Privacy & Security > Accessibility, then retry.
    """)
}

let args = Array(CommandLine.arguments.dropFirst())
switch args.first {
case "state":
  print(centerIsOpen() ? "open" : "closed")
case "open":
  setCenter(open: true)
case "close":
  setCenter(open: false)
case "list":
  let rows = reminderRows().map { row -> [String: Any] in
    let labels = row.actions.map(label).filter { $0 != "AXPress" && $0 != "AXScrollToVisible" }
    return ["kind": row.kind, "body": row.body, "actions": labels]
  }
  print(json(rows))
case "act":
  guard args.count == 3 else { fail("usage: act <body> <action>") }
  guard let row = reminderRows().first(where: { $0.body == args[1] }) else {
    fail("no Obsidian Reminder notification with body '\(args[1])'", 3)
  }
  guard let raw = rawAction(for: args[2], in: row) else {
    fail("notification '\(row.body)' has no action '\(args[2])'; it has: \(row.actions.map(label))", 4)
  }
  if !perform(raw, on: row) { fail("performing '\(args[2])' on '\(row.body)' failed") }
  print(json(["kind": row.kind, "body": row.body, "action": label(raw)]))
case "clear-all":
  var cleared = 0
  for _ in 0..<200 {
    guard let row = reminderRows().first, let raw = rawAction(for: "close", in: row) else { break }
    if !perform(raw, on: row) { fail("closing '\(row.body)' failed after \(cleared) cleared") }
    cleared += 1
    usleep(300_000)
  }
  print(json(["cleared": cleared, "remaining": reminderRows().count]))
default:
  fail("usage: notification-center (state | open | close | list | act <body> <action> | clear-all)")
}
