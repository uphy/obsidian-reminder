import { Symbol } from './splitter';

export class TasksPluginSymbols {
    public static readonly dueDate = Symbol.ofChars([...'📅📆🗓']);
    static readonly doneDate = Symbol.ofChar('✅');
    static readonly recurrence = Symbol.ofChar('🔁');
    public static readonly reminder = Symbol.ofChar('⏰');
    public static readonly scheduled = Symbol.ofChars([...'⏳⌛']);
    static readonly start = Symbol.ofChar('🛫');
    static readonly allSymbols = [
        TasksPluginSymbols.dueDate,
        TasksPluginSymbols.doneDate,
        TasksPluginSymbols.recurrence,
        TasksPluginSymbols.reminder,
        TasksPluginSymbols.start,
        TasksPluginSymbols.scheduled,
    ];
    public static getSymbolByPrimaryEmoji(primaryEmoji: string) {
        for (const s of TasksPluginSymbols.allSymbols) {
            if (s.primary === primaryEmoji) {
                return s;
            }
        }
        return null;
    }
}
