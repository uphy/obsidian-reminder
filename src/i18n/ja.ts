/**
 * Japanese translations, keyed by the English UI text.
 *
 * Placeholders (`{count}`, `{file}`, ...) must be kept verbatim: `t()` fills
 * them in after the lookup. English is the source language and needs no
 * dictionary, so a missing entry here falls back to the English text.
 *
 * Keys that were assembled from several source fragments are keyed by the
 * joined result, so editing a fragment in the source invalidates its entry
 * (it then falls back to English) rather than showing a wrong translation.
 *
 * Wording follows Obsidian's own Japanese UI where the two overlap: "vault" is
 * 保管庫, "Live Preview" is ライブプレビュー and "daily notes" are デイリーノート.
 */
export const ja: Record<string, string> = {
  // --- Settings tab: pages and groups -------------------------------------
  Display: "表示",
  Editor: "エディタ",
  Notifications: "通知",
  "Reminder formats": "リマインダーの書式",
  Advanced: "詳細",
  ntfy: "ntfy",
  "Reminder plugin format": "Reminder プラグインの書式",
  "Tasks plugin format": "Tasks プラグインの書式",
  "Task statuses": "タスクのステータス",
  "Dataview format": "Dataview の書式",
  "Kanban plugin format": "Kanban プラグインの書式",

  // --- Settings tab: language --------------------------------------------
  Language: "言語",
  "Automatic (follow Obsidian)": "自動（Obsidian に合わせる）",
  "Language of this plugin's own interface: settings, notices, reminder popups, the reminder list and command names. Automatic follows Obsidian's own UI language. Month and weekday names follow the selected language as well where the display formats use them.":
    "このプラグイン自体の表示言語です。設定、通知メッセージ、リマインダーのポップアップ、リマインダー一覧、コマンド名に適用されます。「自動」では Obsidian の表示言語に合わせます。表示形式で使う月名と曜日名も、選んだ言語で表示します。",

  // --- Settings tab: notifications ---------------------------------------
  "Reminder time": "リマインド時刻",
  "Time when a reminder with no time part will show":
    "時刻を書いていないリマインダーを通知する時刻",
  "Reminder time step (minutes)": "リマインド時刻の刻み（分）",
  "Step of time for reminder time (minutes)":
    "リマインド時刻を選ぶときの刻み（分）",
  "Enable reminder notifications": "リマインダーの通知を有効にする",
  "If disabled, reminder popups and system notifications are not shown. The reminder list view keeps working.":
    "無効にすると、リマインダーのポップアップとシステム通知を表示しません。リマインダー一覧はそのまま使えます。",
  "Re-notify muted reminders on startup":
    "起動時にミュートしたリマインダーを再通知する",
  'When enabled, reminders you previously muted are notified again the next time Obsidian starts. Useful if you rely on startup notifications to review overdue reminders. If many reminders are overdue, they are shown one after another — use the "Mute all current notifications" command to silence them again.':
    "有効にすると、ミュートしたリマインダーを次に Obsidian を起動したときに再び通知します。起動時の通知で期限切れのリマインダーを見直している場合に便利です。期限切れのリマインダーが多いと次々に表示されるので、そのときは「現在の通知をすべてミュート」コマンドで再びミュートしてください。",
  "Reminder popup style": "リマインダーのポップアップの形式",
  "Toast: a card in the corner of the window that does not interrupt your work. Modal: a dialog in the center of the window that takes focus.":
    "トースト: ウィンドウの隅に出るカードで、作業を中断しません。モーダル: ウィンドウの中央に出るダイアログで、フォーカスを奪います。",
  "Toast (corner card)": "トースト（隅のカード）",
  "Modal (center dialog)": "モーダル（中央のダイアログ）",
  "Open note on reminder click": "リマインダーのクリックでノートを開く",
  "When clicking a reminder in the reminder list or a system notification, open the note directly instead of showing the reminder popup.":
    "リマインダー一覧のリマインダーやシステム通知をクリックしたとき、リマインダーのポップアップを出さずにノートを直接開きます。",
  "Use system notification": "システム通知を使う",
  "Use system notification for reminder notifications":
    "リマインダーの通知に OS のシステム通知を使います",
  "Show popup together with system notification":
    "システム通知と一緒にポップアップも表示する",
  "When using system notification, also show the built-in reminder popup at the same time. The popup handles the reminder actions; the system notification acts as an alert only.":
    "システム通知を使うとき、プラグインのリマインダーのポップアップも同時に表示します。リマインダーの操作はポップアップで行い、システム通知は知らせるだけです。",
  "Keep system notification on screen": "システム通知を画面に残す",
  "Keep the system notification on screen until you interact with it, instead of it disappearing after a few seconds. Only effective on Windows and Linux; ignored on macOS. Enable this if you use the same vault on multiple devices (e.g. via Obsidian Sync): it allows the plugin to dismiss the notification when you complete or snooze the reminder on another device.":
    "システム通知を数秒で消さず、操作するまで画面に残します。Windows と Linux でのみ有効で、macOS では無視されます。同じ保管庫を複数の端末で使っている場合（Obsidian Sync など）は有効にしてください。別の端末でリマインダーを完了またはスヌーズしたときに、このプラグインが通知を消せるようになります。",
  "Focus Done button on popup": "ポップアップで「完了」ボタンにフォーカスする",
  "Automatically focus the Done button when a reminder popup opens, so pressing Enter completes the task. Off by default to prevent accidentally completing a reminder you haven't read.":
    "リマインダーのポップアップが開いたときに「完了」ボタンにフォーカスし、Enter キーでタスクを完了できるようにします。読んでいないリマインダーを誤って完了しないよう、既定では無効です。",
  "Show overdue count in status bar":
    "ステータスバーに期限切れの件数を表示する",
  "Show the number of overdue reminders in the status bar. Click it to open the reminder list.":
    "期限切れのリマインダーの件数をステータスバーに表示します。クリックするとリマインダー一覧を開きます。",
  "Remind me later": "スヌーズの選択肢",
  "Line-separated list of remind me later items":
    "「スヌーズ」で選べる時間の一覧（1行に1つ）",

  // --- Settings tab: editor ----------------------------------------------
  "Calendar popup trigger": "カレンダーのポップアップを開く文字列",
  "Trigger text to show calendar popup":
    "入力するとカレンダーのポップアップを開く文字列",
  "Popup is enabled": "ポップアップは有効です",
  "Popup is disabled": "ポップアップは無効です",
  "Convert non-task lines when inserting a reminder":
    "リマインダーの挿入時にタスクでない行を変換する",
  'When inserting a reminder from the calendar popup on a line that is not a task, convert the line into a task list item ("- [ ] ") automatically. When disabled, a notice is shown instead.':
    "タスクでない行でカレンダーのポップアップからリマインダーを挿入したとき、その行を自動でタスクリストの項目（「- [ ] 」）に変換します。無効にすると、変換せずにお知らせを表示します。",
  "Primary reminder format": "既定のリマインダーの書式",
  "Reminder format for generated reminder by calendar popup":
    "カレンダーのポップアップで挿入するリマインダーの書式",
  "Show reminder pills in editor": "エディタにリマインダーのピルを表示する",
  "Render each reminder's time as a clickable pill (⏰) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.":
    "ライブプレビューで、各リマインダーの日時をクリックできるピル（⏰）として表示します。ピルをクリックすると日時の選択画面が開き、日時を変更できます。無効にすると、リマインダーの元のテキストをそのまま表示します。",
  "Enable {format}": "{format}を有効にする",
  "Recognize reminders written in this format.":
    "この書式で書かれたリマインダーを認識します。",
  "Example: {example}": "例: {example}",
  "Distinguish between reminder date and due date":
    "リマインド日と期日を区別する",
  "Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.":
    "📅 の代わりに独自の絵文字 ⏰ を使い、リマインド日時と Tasks プラグインの期日（due）を区別します。",
  "Fall back to due, scheduled, or start date":
    "期日・予定日・開始日で代用する",
  "When the reminder date (⏰) is missing, use the due date (📅), then the scheduled date (⏳), then the start date (🛫), in that order.":
    "リマインド日（⏰）が無いときは、期日（📅）、予定日（⏳）、開始日（🛫）の順に代わりに使います。",
  "Remove tags from reminder title": "リマインダーのタイトルからタグを除く",
  "If checked, tags(#xxx) are removed from the reminder list view and notification.":
    "有効にすると、リマインダー一覧と通知でタグ（#xxx）を表示しません。",
  "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). Applies to every reminder format and to the 'Toggle checklist status' command. Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. Leave empty to follow the defaults alone.":
    "1行に1つのステータスを「[記号] -> [次の記号] 種類」の形で書きます。種類は TODO、IN_PROGRESS、DONE、CANCELLED、ON_HOLD、NON_TASK のいずれかです。この設定で、どの行を完了とみなすか（DONE/CANCELLED/NON_TASK は通知しません）と、「完了」ボタンが書き込む記号（次の記号が完了のステータスに当たるときはその記号）が決まります。すべてのリマインダーの書式と「チェックリストの状態を切り替え」コマンドに適用されます。ここに書いた行は既定値（Tasks プラグインが有効ならその設定のステータス、無効なら組み込みの [ ]/[x]/[-]）に追加され、記号が重なるときはこちらが優先されます。空にすると既定値だけを使います。",
  "Unknown status types (treated as TODO): {types}":
    "不明なステータスの種類（TODO として扱います）: {types}",
  "Reminder field name": "リマインダーのフィールド名",
  "The inline field (e.g. [reminder:: 2021-09-08]) read as the reminder date. On a line that also has a due field, this field takes precedence.":
    "リマインド日として読み取るインラインフィールド（例: [reminder:: 2021-09-08]）。同じ行に期日のフィールドもある場合は、こちらを優先します。",

  // --- Settings tab: display ---------------------------------------------
  "Year & month format": "年月の書式",
  "Month & day format": "月日の書式",
  "Short date with weekday format": "曜日つき短い日付の書式",
  "Time format": "時刻の書式",
  "Week start": "週の始まり",
  "Select the first day of the week": "週の最初の曜日を選びます",
  "Moment style year and month format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 形式の年月の書式:\nhttps://momentjs.com/docs/#/displaying/format/",
  "Moment style month and day format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 形式の月日の書式:\nhttps://momentjs.com/docs/#/displaying/format/",
  "Moment style short date with weekday format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 形式の曜日つき短い日付の書式:\nhttps://momentjs.com/docs/#/displaying/format/",
  "Moment style time format:\nhttps://momentjs.com/docs/#/displaying/format/":
    "Moment 形式の時刻の書式:\nhttps://momentjs.com/docs/#/displaying/format/",
  "moment style date format: https://momentjs.com/docs/#/displaying/format/":
    "moment 形式の日付の書式: https://momentjs.com/docs/#/displaying/format/",
  "moment() style date time format: https://momentjs.com/docs/#/displaying/format/":
    "moment() 形式の日時の書式: https://momentjs.com/docs/#/displaying/format/",

  // --- Settings tab: date format presets ---------------------------------
  "US Style (12h)": "米国式（12時間制）",
  "US Style (24h)": "米国式（24時間制）",
  "EU Style (24h)": "欧州式（24時間制）",
  "EU Style (12h)": "欧州式（12時間制）",
  "JP Style (24h)": "日本式（24時間制）",
  "JP Style (12h)": "日本式（12時間制）",
  "Year/Month: {value}": "年月: {value}",
  "Month/Day: {value}": "月日: {value}",
  "Short: {value}": "短い日付: {value}",
  "Time: {value}": "時刻: {value}",

  // --- Settings tab: ntfy -------------------------------------------------
  "Enable ntfy scheduled notifications (experimental)":
    "ntfy の予約通知を有効にする（実験的）",
  "Publish upcoming reminders to the ntfy server below as scheduled push notifications, so you're notified even when Obsidian isn't running (useful on mobile, where plugins can't run in the background). This sends reminder titles to that server, so only enable this if you trust it. Requires an ntfy server running v2.16.0 or later (needed for sequence-ID based scheduled message replacement/deletion). Only reminders due within the next 24 hours are registered — ntfy itself allows scheduling at most 3 days ahead, and this plugin periodically re-registers reminders to roll that 24-hour window forward.":
    "これから来るリマインダーを、下の ntfy サーバーに予約プッシュ通知として送ります。Obsidian が動いていなくても通知を受け取れます（プラグインがバックグラウンドで動けないモバイルで便利です）。リマインダーのタイトルがそのサーバーに送られるので、信頼できるサーバーのときだけ有効にしてください。ntfy サーバーは v2.16.0 以降が必要です（シーケンス ID による予約メッセージの置き換えと削除に使います）。登録するのは今から24時間以内のリマインダーだけです。ntfy 自体は最大3日先までしか予約できず、このプラグインは定期的にリマインダーを登録し直して、その24時間の範囲を先へ進めます。",
  "ntfy server URL": "ntfy サーバーの URL",
  "The ntfy server to publish scheduled notifications to.":
    "予約通知を送る ntfy サーバー。",
  "ntfy topic": "ntfy のトピック",
  "Topic to publish reminders to. Anyone who knows this topic name can subscribe to it and read your reminder titles, so use a long, hard-to-guess name rather than something predictable. May only contain letters, digits, dashes and underscores (1-64 characters).":
    "リマインダーを送るトピック。トピック名を知っている人は誰でも購読してリマインダーのタイトルを読めるので、推測しやすい名前ではなく、長く推測しにくい名前にしてください。使える文字は英字・数字・ハイフン・アンダースコアだけです（1〜64文字）。",
  "A topic may only contain letters, digits, dashes and underscores (1-64 characters).":
    "トピックに使える文字は英字・数字・ハイフン・アンダースコアだけです（1〜64文字）。",
  "ntfy access token": "ntfy のアクセストークン",
  "Only needed for a server that requires authentication (a self-hosted instance with access control, for example); leave it empty otherwise. Create one with `ntfy token add <user>` or from the ntfy web app under Account → Access tokens. The token needs read-write access to the topic above, because this plugin reads, publishes and deletes scheduled messages. It is stored in plain text in this plugin's data.json, which is synced along with your vault if you sync your Obsidian configuration folder.":
    "認証が必要なサーバー（アクセス制御を設定した自前のサーバーなど）のときだけ入力し、それ以外は空のままにしてください。`ntfy token add <user>` か、ntfy の Web アプリの Account → Access tokens で作れます。このプラグインは予約メッセージを読み取り・送信・削除するので、トークンには上のトピックへの読み書きの権限が要ります。トークンはこのプラグインの data.json に平文で保存され、Obsidian の設定フォルダを同期している場合は保管庫と一緒に同期されます。",
  Test: "テスト",
  "Testing…": "テスト中…",
  "Set the ntfy server URL first.":
    "先に ntfy サーバーの URL を設定してください。",
  "Set the ntfy topic first.": "先に ntfy のトピックを設定してください。",
  "The ntfy topic is not a valid topic name: use only letters, digits, dashes and underscores (1-64 characters).":
    "ntfy のトピック名が正しくありません。英字・数字・ハイフン・アンダースコアだけを使ってください（1〜64文字）。",
  "Reading the topic": "トピックの読み取り",
  "Publishing a test message": "テストメッセージの送信",
  "Deleting the test message": "テストメッセージの削除",
  "{step} was refused ({detail}). Check the access token, and that it has read-write access to this topic.":
    "{step}が拒否されました（{detail}）。アクセストークンと、そのトークンにこのトピックへの読み書きの権限があるかを確かめてください。",
  "{step} failed ({detail}). Check the server URL.":
    "{step}に失敗しました（{detail}）。サーバーの URL を確かめてください。",
  "{step} failed ({detail}).": "{step}に失敗しました（{detail}）。",
  "{step} It stays scheduled until the next sync removes it.":
    "{step} このメッセージは次の同期で消えるまで予約されたままです。",
  "Connected. Reading, publishing and deleting all succeeded.":
    "接続できました。読み取り・送信・削除がすべて成功しました。",
  "Could not reach {serverUrl}: {error}":
    "{serverUrl} に接続できませんでした: {error}",

  // --- Settings tab: advanced --------------------------------------------
  "Excluded files/folders": "除外するファイル・フォルダ",
  "Reminders in these files/folders are ignored. One vault-relative path per line (e.g. Templates or Archive/2020).":
    "ここに書いたファイル・フォルダのリマインダーは無視します。保管庫からの相対パスを1行に1つ書きます（例: Templates、Archive/2020）。",
  "Edit detection time": "編集中とみなす時間",
  "The minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable. Only applies to the Modal popup style; Toast reminders are shown immediately even while typing.":
    "キー入力のあと、通知してよいとみなすまでの最短の時間（秒）。ポップアップの形式がモーダルのときだけ適用されます。トーストは入力中でもすぐに表示します。",
  "Reminder check interval": "リマインダーを確認する間隔",
  "Interval(in seconds) to periodically check whether or not you should be notified of reminders.  You will need to restart Obsidian for this setting to take effect.":
    "通知すべきリマインダーがあるかを定期的に確認する間隔（秒）。変更を反映するには Obsidian の再起動が必要です。",
  "Please enter a valid number.": "正しい数値を入力してください。",

  // --- Commands -----------------------------------------------------------
  "Rescan all files": "すべてのファイルを再スキャン",
  "Open list view": "一覧を開く",
  "Convert time format": "時刻の書式を変換",
  "Show calendar popup": "カレンダーのポップアップを表示",
  "Toggle checklist status": "チェックリストの状態を切り替え",
  "Set date display format": "日付の表示形式を設定",
  "Pause notifications": "通知を一時停止",
  "Resume notifications": "通知を再開",
  "Mute all current notifications": "現在の通知をすべてミュート",
  "Convert reminder time format": "リマインダーの時刻の書式を変換",
  "This command rewrite reminder dates in all markdown files.  You should make a backup of your vault before you execute this.  May I continue to convert?":
    "このコマンドは、すべての Markdown ファイルのリマインダーの日付を書き換えます。実行する前に保管庫のバックアップを取ってください。変換を続けますか？",
  OK: "OK",
  Cancel: "キャンセル",

  // --- Notices ------------------------------------------------------------
  "Reminder notifications paused until {time}":
    "リマインダーの通知を {time} まで一時停止しました",
  "Reminder notifications resumed": "リマインダーの通知を再開しました",
  "Muted {count} reminder": "{count}件のリマインダーをミュートしました",
  "Muted {count} reminders": "{count}件のリマインダーをミュートしました",
  'Cannot insert a reminder here.  Reminders can only be added to task lines such as "- [ ] task".':
    "ここにはリマインダーを挿入できません。リマインダーは「- [ ] タスク」のようなタスクの行にだけ追加できます。",

  // --- Reminder list, popup and status bar -------------------------------
  Reminders: "リマインダー",
  Overdue: "期限切れ",
  Today: "今日",
  Tomorrow: "明日",
  "Over 1 week": "1週間より先",
  "No reminders": "リマインダーはありません",
  Done: "完了",
  Open: "開く",
  Mute: "ミュート",
  Snooze: "スヌーズ",
  Close: "閉じる",
  "Pause all notifications…": "すべての通知を一時停止…",
  "Mute all reminders…": "すべてのリマインダーをミュート…",
  "Pause all notifications for a chosen duration. Reminders are not muted: anything still overdue notifies you again after the pause ends.":
    "選んだ時間だけ、すべての通知を一時停止します。リマインダーはミュートしないので、一時停止が終わったときに期限切れのままのものは再び通知します。",
  "Mute every currently overdue reminder. Muted reminders stay silent (even across restarts) until you snooze them or change their date.":
    "いま期限切れのリマインダーをすべてミュートします。ミュートしたリマインダーは、スヌーズするか日付を変えるまで（再起動しても）通知しません。",
  "Pause reminder notifications for...":
    "リマインダーの通知を一時停止する時間…",
  "Overdue reminders — click to open the reminder list":
    "期限切れのリマインダー — クリックでリマインダー一覧を開きます",
  "Click to resume reminder notifications":
    "クリックでリマインダーの通知を再開します",
  "🔕 Until {time}": "🔕 {time} まで",
  "Reminder: {title}": "リマインダー: {title}",

  // --- Date and time picker ----------------------------------------------
  "Show quick date picks": "よく使う日付を表示",
  "Show calendar": "カレンダーを表示",
  "Time:": "時刻:",
  "Filter...": "絞り込み…",

  // --- Snooze options -----------------------------------------------------
  "In {count} {unit}": "{count}{unit}後",
  minute: "分",
  minutes: "分",
  hour: "時間",
  hours: "時間",
  day: "日",
  days: "日",
  week: "週間",
  weeks: "週間",
  month: "か月",
  months: "か月",
  year: "年",
  years: "年",
  "In 30 minutes": "30分後",
  "In 1 hours": "1時間後",
  "In 3 hours": "3時間後",
  "Next week": "来週",
  "Next month": "来月",
  "Next year": "来年",
  "Next Sunday": "次の日曜日",
  "Next Monday": "次の月曜日",
  "Next Tuesday": "次の火曜日",
  "Next Wednesday": "次の水曜日",
  "Next Thursday": "次の木曜日",
  "Next Friday": "次の金曜日",
  "Next Saturday": "次の土曜日",
  "Unsupported format.  Should be 'In N (minutes|hours)'":
    "対応していない書式です。「In N (minutes|hours)」の形で書いてください。",
  "Unsupported format: {format}": "対応していない書式です: {format}",
  "Unsupported weekday: {weekday}": "対応していない曜日です: {weekday}",

  // --- System notification ------------------------------------------------
  "Obsidian Reminder": "Obsidian Reminder",
  "Mark as Done": "完了にする",

  // --- Validation messages ------------------------------------------------
  "Unexpected format time({time}). Time must be HH:mm.":
    "時刻の書式が正しくありません（{time}）。HH:mm の形で書いてください。",
  "hour must be 0~23": "時は0〜23で指定してください",
  "minute must be 0~59": "分は0〜59で指定してください",
  "Link dates to daily notes": "日付をデイリーノートにリンクする",
  "When toggled, Dates link to daily notes.":
    "有効にすると、日付をデイリーノートへのリンクにします。",
  "Date format": "日付の書式",
  "Date and time format": "日時の書式",
  "Strict date format": "日付の書式を厳密に扱う",
  "Strictly parse the date and time": "日付と時刻を厳密に解析します",
};
