/**
 * Simplified Chinese translations, keyed by the English UI text.
 *
 * Placeholders (`{count}`, `{file}`, ...) must be kept verbatim: `t()` fills
 * them in after the lookup. English is the source language and needs no
 * dictionary, so a missing entry here falls back to the English text.
 *
 * Keys that were assembled from several source fragments are keyed by the
 * joined result, so editing a fragment in the source invalidates its entry
 * (it then falls back to English) rather than showing a wrong translation.
 */
export const zhCN: Record<string, string> = {
  // --- Settings tab: pages and groups -------------------------------------
  Display: "显示",
  Editor: "编辑器",
  Notifications: "通知",
  "Reminder formats": "提醒格式",
  Advanced: "高级",
  ntfy: "ntfy",
  "Reminder plugin format": "Reminder 插件格式",
  "Tasks plugin format": "Tasks 插件格式",
  "Task statuses": "任务状态",
  "Dataview format": "Dataview 格式",
  "Kanban plugin format": "Kanban 插件格式",

  // --- Settings tab: language --------------------------------------------
  Language: "语言",
  "Automatic (follow Obsidian)": "自动（跟随 Obsidian）",
  "Language of this plugin's own interface: settings, notices, reminder popups, the reminder list and command names. Automatic follows Obsidian's own UI language. Month and weekday names follow the selected language as well where the display formats use them.":
    "本插件自身界面的语言：设置项、提示、提醒弹窗、提醒列表和命令名称。选择“自动”时跟随 Obsidian 的界面语言；显示格式中出现的月份名和星期名也会跟随所选语言。",

  // --- Settings tab: notifications ---------------------------------------
  "Reminder time": "提醒时间",
  "Time when a reminder with no time part will show":
    "没有时间部分的提醒在几点显示",
  "Reminder time step (minutes)": "提醒时间步长（分钟）",
  "Step of time for reminder time (minutes)": "提醒时间的步长（分钟）",
  "Enable reminder notifications": "启用提醒通知",
  "If disabled, reminder popups and system notifications are not shown. The reminder list view keeps working.":
    "禁用后不再显示提醒弹窗和系统通知，提醒列表仍然可用。",
  "Re-notify muted reminders on startup": "启动时重新通知被忽略的提醒",
  'When enabled, reminders you previously muted are notified again the next time Obsidian starts. Useful if you rely on startup notifications to review overdue reminders. If many reminders are overdue, they are shown one after another — use the "Mute all current notifications" command to silence them again.':
    "开启后，之前被你忽略的提醒会在下次启动 Obsidian 时再次通知。如果你依赖启动通知来检查逾期提醒，这个选项很有用。如果逾期提醒很多，它们会依次弹出 —— 可以用“忽略当前所有通知”命令让它们重新静默。",
  "Reminder popup style": "提醒弹窗样式",
  "Toast: a card in the corner of the window that does not interrupt your work. Modal: a dialog in the center of the window that takes focus.":
    "胶囊：显示在窗口角落的卡片，不会打断你的工作。模态框：位于窗口中央、会抢占焦点的对话框。",
  "Toast (corner card)": "胶囊（角落卡片）",
  "Modal (center dialog)": "模态框（居中对话框）",
  "Open note on reminder click": "点击提醒时打开笔记",
  "When clicking a reminder in the reminder list or a system notification, open the note directly instead of showing the reminder popup.":
    "点击提醒列表中的提醒或系统通知时，直接打开笔记，而不是显示提醒弹窗。",
  "Use system notification": "使用系统通知",
  "Use system notification for reminder notifications": "使用系统通知发送提醒",
  "Show popup together with system notification": "同时显示弹窗和系统通知",
  "When using system notification, also show the built-in reminder popup at the same time. The popup handles the reminder actions; the system notification acts as an alert only.":
    "使用系统通知时，同时显示内置的提醒弹窗。提醒操作由弹窗处理，系统通知只作为提示。",
  "Keep system notification on screen": "保持系统通知常驻",
  "Keep the system notification on screen until you interact with it, instead of it disappearing after a few seconds. Only effective on Windows and Linux; ignored on macOS. Enable this if you use the same vault on multiple devices (e.g. via Obsidian Sync): it allows the plugin to dismiss the notification when you complete or snooze the reminder on another device.":
    "让系统通知一直显示，直到你与它交互，而不是几秒后自动消失。仅在 Windows 和 Linux 上有效，macOS 会忽略此设置。如果你在多台设备上使用同一个仓库（例如通过 Obsidian Sync），建议开启：这样在另一台设备上完成或稍后提醒时，本插件可以关闭这条通知。",
  "Focus Done button on popup": "弹窗聚焦“完成”按钮",
  "Automatically focus the Done button when a reminder popup opens, so pressing Enter completes the task. Off by default to prevent accidentally completing a reminder you haven't read.":
    "提醒弹窗出现时自动聚焦“完成”按钮，这样按回车即可完成任务。默认关闭，以免误将尚未阅读的提醒标记为完成。",
  "Show overdue count in status bar": "在状态栏显示逾期数量",
  "Show the number of overdue reminders in the status bar. Click it to open the reminder list.":
    "在状态栏显示已逾期提醒的数量，点击它可以打开提醒列表。",
  "Remind me later": "稍后提醒",
  "Line-separated list of remind me later items":
    "“稍后提醒”选项列表，每行一项",

  // --- Settings tab: editor ----------------------------------------------
  "Calendar popup trigger": "日历弹窗触发文本",
  "Trigger text to show calendar popup": "触发日历弹窗的文本",
  "Popup is enabled": "弹窗已启用",
  "Popup is disabled": "弹窗已禁用",
  "Convert non-task lines when inserting a reminder": "插入提醒时转换非任务行",
  'When inserting a reminder from the calendar popup on a line that is not a task, convert the line into a task list item ("- [ ] ") automatically. When disabled, a notice is shown instead.':
    "在非任务行上通过日历弹窗插入提醒时，自动把该行转换为任务列表项（“- [ ] ”）。关闭时改为显示一条提示。",
  "Primary reminder format": "首选提醒格式",
  "Reminder format for generated reminder by calendar popup":
    "日历弹窗生成提醒时使用的格式",
  "Show reminder pills in editor": "在编辑器中显示提醒胶囊",
  "Render each reminder's time as a clickable pill (⏰) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.":
    "在实时预览中把每条提醒的时间渲染成可点击的胶囊（⏰）。点击胶囊可以打开日期/时间选择器进行修改。关闭后改为显示原始提醒文本。",
  "Enable {format}": "启用{format}",
  "Recognize reminders written in this format.": "识别用这种格式书写的提醒。",
  "Example: {example}": "示例：{example}",
  "Distinguish between reminder date and due date": "区分提醒日期和截止日期",
  "Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.":
    "用自定义 emoji ⏰ 代替 📅，以区分提醒日期/时间与 Tasks 插件的截止日期。",
  "Fall back to due, scheduled, or start date":
    "回退到截止日期、计划日期或开始日期",
  "When the reminder date (⏰) is missing, use the due date (📅), then the scheduled date (⏳), then the start date (🛫), in that order.":
    "当提醒日期（⏰）缺失时，依次使用截止日期（📅）、计划日期（⏳）和开始日期（🛫）。",
  "Remove tags from reminder title": "从提醒标题中移除标签",
  "If checked, tags(#xxx) are removed from the reminder list view and notification.":
    "勾选后，标签（#xxx）会从提醒列表和通知中移除。",
  "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). Applies to every reminder format and to the 'Toggle checklist status' command. Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. Leave empty to follow the defaults alone.":
    "每行一个状态：[符号] -> [下一个符号] 类型，其中类型可以是 TODO、IN_PROGRESS、DONE、CANCELLED、ON_HOLD 或 NON_TASK。它决定哪些行算作已完成（DONE/CANCELLED/NON_TASK 不再提醒），以及“完成”按钮会写入哪个符号（下一个符号，当它指向已完成状态时）。对所有提醒格式和“切换清单状态”命令都生效。这里的内容会在默认值之上追加（启用 Tasks 插件时使用它的状态设置，否则使用内置的 [ ]/[x]/[-]），符号重复时优先于默认值。留空则完全沿用默认值。",
  "Unknown status types (treated as TODO): {types}":
    "未知的状态类型（按 TODO 处理）：{types}",
  "Reminder field name": "提醒字段名",
  "The inline field (e.g. [reminder:: 2021-09-08]) read as the reminder date. On a line that also has a due field, this field takes precedence.":
    "作为提醒日期读取的内联字段（例如 [reminder:: 2021-09-08]）。如果同一行还有截止日期字段，则优先使用本字段。",

  // --- Settings tab: display ---------------------------------------------
  "Year & month format": "年和月格式",
  "Month & day format": "月和日格式",
  "Short date with weekday format": "含星期的短日期格式",
  "Time format": "时间格式",
  "Week start": "一周起始日",
  "Select the first day of the week": "选择一周的第一天",
  "Moment style year and month format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 风格的年月格式：\nhttps://momentjs.com/docs/#/displaying/format/",
  "Moment style month and day format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 风格的月日格式：\nhttps://momentjs.com/docs/#/displaying/format/",
  "Moment style short date with weekday format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 风格的短日期（含星期）格式：\nhttps://momentjs.com/docs/#/displaying/format/",
  "Moment style time format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 风格的时间格式：\nhttps://momentjs.com/docs/#/displaying/format/",
  "moment style date format: https://momentjs.com/docs/#/displaying/format/":
    "moment 风格的日期格式：https://momentjs.com/docs/#/displaying/format/",
  "moment() style date time format: https://momentjs.com/docs/#/displaying/format/":
    "moment() 风格的日期时间格式：https://momentjs.com/docs/#/displaying/format/",

  // --- Settings tab: date format presets ---------------------------------
  "US Style (12h)": "美式（12 小时制）",
  "US Style (24h)": "美式（24 小时制）",
  "EU Style (24h)": "欧式（24 小时制）",
  "EU Style (12h)": "欧式（12 小时制）",
  "JP Style (24h)": "日式（24 小时制）",
  "JP Style (12h)": "日式（12 小时制）",
  "Year/Month: {value}": "年/月：{value}",
  "Month/Day: {value}": "月/日：{value}",
  "Short: {value}": "短日期：{value}",
  "Time: {value}": "时间：{value}",

  // --- Settings tab: ntfy -------------------------------------------------
  "Enable ntfy scheduled notifications (experimental)":
    "启用 ntfy 定时通知（实验性）",
  "Publish upcoming reminders to the ntfy server below as scheduled push notifications, so you're notified even when Obsidian isn't running (useful on mobile, where plugins can't run in the background). This sends reminder titles to that server, so only enable this if you trust it. Requires an ntfy server running v2.16.0 or later (needed for sequence-ID based scheduled message replacement/deletion). Only reminders due within the next 24 hours are registered — ntfy itself allows scheduling at most 3 days ahead, and this plugin periodically re-registers reminders to roll that 24-hour window forward.":
    "把即将到来的提醒作为定时推送消息发布到下面的 ntfy 服务器，这样即使 Obsidian 没有运行也能收到通知（对无法在后台运行插件的移动端尤其有用）。该功能会把提醒标题发送到该服务器，因此只有在你信任它时才应开启。需要 ntfy 服务器为 v2.16.0 或更高版本（用于基于序列 ID 的定时消息替换/删除）。只会注册未来 24 小时内到期的提醒 —— ntfy 本身最多允许提前 3 天调度，本插件会定期重新注册提醒，把这一 24 小时窗口向前滚动。",
  "ntfy server URL": "ntfy 服务器 URL",
  "The ntfy server to publish scheduled notifications to.":
    "用于发布定时通知的 ntfy 服务器。",
  "ntfy topic": "ntfy 主题",
  "Topic to publish reminders to. Anyone who knows this topic name can subscribe to it and read your reminder titles, so use a long, hard-to-guess name rather than something predictable. May only contain letters, digits, dashes and underscores (1-64 characters).":
    "发布提醒的目标主题。任何知道该主题名的人都能订阅并读到你的提醒标题，因此请使用较长且难以猜测的名称，而不是规律可猜的名字。只能包含字母、数字、短横线和下划线（1-64 个字符）。",
  "A topic may only contain letters, digits, dashes and underscores (1-64 characters).":
    "主题只能包含字母、数字、短横线和下划线（1-64 个字符）。",
  "ntfy access token": "ntfy 访问令牌",
  "Only needed for a server that requires authentication (a self-hosted instance with access control, for example); leave it empty otherwise. Create one with `ntfy token add <user>` or from the ntfy web app under Account → Access tokens. The token needs read-write access to the topic above, because this plugin reads, publishes and deletes scheduled messages. It is stored in plain text in this plugin's data.json, which is synced along with your vault if you sync your Obsidian configuration folder.":
    "仅当服务器需要身份验证时（例如带访问控制的自建实例）才需要填写，否则请留空。可以用 `ntfy token add <user>` 或在 ntfy 网页端的“Account → Access tokens”中创建。该令牌需要对上面的主题有读写权限，因为本插件会读取、发布并删除定时消息。它以明文保存在本插件的 data.json 中；如果你同步 Obsidian 配置文件夹，它也会被一并同步。",
  Test: "测试",
  "Testing…": "测试中…",
  "Set the ntfy server URL first.": "请先填好 ntfy 服务器 URL。",
  "Set the ntfy topic first.": "请先填好 ntfy 主题。",
  "The ntfy topic is not a valid topic name: use only letters, digits, dashes and underscores (1-64 characters).":
    "ntfy 主题不是有效的主题名：只能使用字母、数字、短横线和下划线（1-64 个字符）。",
  "Reading the topic": "读取主题",
  "Publishing a test message": "发布测试消息",
  "Deleting the test message": "删除测试消息",
  "{step} was refused ({detail}). Check the access token, and that it has read-write access to this topic.":
    "{step}被拒绝（{detail}）。请检查访问令牌，并确认它对该主题有读写权限。",
  "{step} failed ({detail}). Check the server URL.":
    "{step}失败（{detail}）。请检查服务器 URL。",
  "{step} failed ({detail}).": "{step}失败（{detail}）。",
  "{step} It stays scheduled until the next sync removes it.":
    "{step}。这条消息会一直保持调度状态，直到下次同步将其移除。",
  "Connected. Reading, publishing and deleting all succeeded.":
    "连接成功：读取、发布和删除都正常。",
  "Could not reach {serverUrl}: {error}": "无法连接到 {serverUrl}：{error}",

  // --- Settings tab: advanced --------------------------------------------
  "Excluded files/folders": "排除的文件/文件夹",
  "Reminders in these files/folders are ignored. One vault-relative path per line (e.g. Templates or Archive/2020).":
    "这些文件/文件夹中的提醒会被忽略。每行一个相对于仓库的路径（例如 Templates 或 Archive/2020）。",
  "Edit detection time": "编辑判定时间",
  "The minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable. Only applies to the Modal popup style; Toast reminders are shown immediately even while typing.":
    "按键输入后至少经过多少秒，才会被判定为可以通知。仅对模态框弹窗样式有效；胶囊式提醒即使正在输入也会立即显示。",
  "Reminder check interval": "提醒检查间隔",
  "Interval(in seconds) to periodically check whether or not you should be notified of reminders.  You will need to restart Obsidian for this setting to take effect.":
    "周期性检查是否有提醒需要通知的时间间隔（秒）。修改后需要重启 Obsidian 才会生效。",
  "Please enter a valid number.": "请输入有效的数字。",

  // --- Commands -----------------------------------------------------------
  "Rescan all files": "重新扫描所有文件",
  "Open list view": "打开列表视图",
  "Convert time format": "转换时间格式",
  "Show calendar popup": "显示日历弹窗",
  "Toggle checklist status": "切换清单状态",
  "Set date display format": "设置日期显示格式",
  "Pause notifications": "暂停通知",
  "Resume notifications": "恢复通知",
  "Mute all current notifications": "忽略当前所有通知",
  "Convert reminder time format": "转换提醒时间格式",
  "This command rewrite reminder dates in all markdown files.  You should make a backup of your vault before you execute this.  May I continue to convert?":
    "该命令会重写所有 Markdown 文件中的提醒日期。执行前请先备份你的仓库。要继续转换吗？",
  OK: "确定",
  Cancel: "取消",

  // --- Notices ------------------------------------------------------------
  "Reminder notifications paused until {time}": "提醒通知已暂停，直到 {time}",
  "Reminder notifications resumed": "提醒通知已恢复",
  "Muted {count} reminder": "已忽略 {count} 条提醒",
  "Muted {count} reminders": "已忽略 {count} 条提醒",
  'Cannot insert a reminder here.  Reminders can only be added to task lines such as "- [ ] task".':
    "无法在此处插入提醒。提醒只能添加到形如“- [ ] 任务”的任务行。",

  // --- Reminder list, popup and status bar -------------------------------
  Reminders: "提醒",
  Overdue: "已逾期",
  Today: "今天",
  Tomorrow: "明天",
  "Over 1 week": "一周以后",
  "No reminders": "没有提醒",
  Done: "完成",
  Open: "打开",
  Mute: "忽略",
  Snooze: "稍后提醒",
  Close: "关闭",
  "Pause all notifications…": "暂停所有通知…",
  "Mute all reminders…": "忽略所有提醒…",
  "Pause all notifications for a chosen duration. Reminders are not muted: anything still overdue notifies you again after the pause ends.":
    "按所选时长暂停所有通知。提醒不会被忽略：暂停结束后，仍然逾期的提醒会再次通知你。",
  "Mute every currently overdue reminder. Muted reminders stay silent (even across restarts) until you snooze them or change their date.":
    "忽略当前所有已逾期的提醒。被忽略的提醒会一直保持静默（重启后依然有效），直到你稍后提醒或修改它的日期。",
  "Pause reminder notifications for...": "暂停提醒通知的时长…",
  "Overdue reminders — click to open the reminder list":
    "已逾期的提醒 — 点击打开提醒列表",
  "Click to resume reminder notifications": "点击恢复提醒通知",
  "🔕 Until {time}": "🔕 暂停至 {time}",
  "Reminder: {title}": "提醒：{title}",

  // --- Date and time picker ----------------------------------------------
  "Show quick date picks": "显示快捷日期选项",
  "Show calendar": "显示日历",
  "Time:": "时间：",
  "Filter...": "筛选…",

  // --- Snooze options -----------------------------------------------------
  "In {count} {unit}": "{count} {unit}后",
  minute: "分钟",
  minutes: "分钟",
  hour: "小时",
  hours: "小时",
  day: "天",
  days: "天",
  week: "周",
  weeks: "周",
  month: "个月",
  months: "个月",
  year: "年",
  years: "年",
  "In 30 minutes": "30 分钟后",
  "In 1 hours": "1 小时后",
  "In 3 hours": "3 小时后",
  "Next week": "下周",
  "Next month": "下个月",
  "Next year": "明年",
  "Next Sunday": "下周日",
  "Next Monday": "下周一",
  "Next Tuesday": "下周二",
  "Next Wednesday": "下周三",
  "Next Thursday": "下周四",
  "Next Friday": "下周五",
  "Next Saturday": "下周六",
  "Unsupported format.  Should be 'In N (minutes|hours)'":
    "不支持的格式。应为“In N (minutes|hours)”。",
  "Unsupported format: {format}": "不支持的格式：{format}",
  "Unsupported weekday: {weekday}": "不支持的星期：{weekday}",

  // --- System notification ------------------------------------------------
  "Obsidian Reminder": "Obsidian 提醒",
  "Mark as Done": "标记为完成",

  // --- Validation messages ------------------------------------------------
  "Unexpected format time({time}). Time must be HH:mm.":
    "时间格式不正确（{time}）。时间必须为 HH:mm。",
  "hour must be 0~23": "小时必须在 0~23 之间",
  "minute must be 0~59": "分钟必须在 0~59 之间",
  "Link dates to daily notes": "将日期链接到日记",
  "When toggled, Dates link to daily notes.": "开启后，日期会链接到日记。",
  "Date format": "日期格式",
  "Date and time format": "日期和时间格式",
  "Strict date format": "严格日期格式",
  "Strictly parse the date and time": "严格解析日期和时间",
};
