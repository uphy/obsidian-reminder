import { ReminderEdit, REMINDER_FORMAT } from "./format";
import { Reminder } from "./reminder";
import { DateTime } from "./time";

export class Todo {
  // e.g: '  - [x] hello'
  // prefix: '  - [ '
  // check: 'x'
  // suffix: '] '
  // body: hello

  constructor(
    public lineIndex: number,
    private prefix: string,
    public checked: boolean,
    private suffix: string,
    public body: string) { }

  public toMarkdown(): string {
    return `${this.prefix}${this.checked ? 'x' : ' '}${this.suffix}${this.body}`;
  }

}

export type TodoEdit = {
  checked?: boolean,
  body?: string,
}

export class MarkdownDocument {

  private static readonly todoRegexp = /^(?<prefix>\s*\- \[)(?<check>.)(?<suffix>\]\s+)(?<body>.*)$/;
  private lines: Array<string>;

  constructor(public file: string, content: string) {
    this.lines = content.split("\n");
  }

  public getTodos(): Array<Todo> {
    const todos: Array<Todo> = [];
    this.lines.forEach((line, lineIndex) => {
      const todo = this.parseTodo(lineIndex, line);
      if (todo) {
        todos.push(todo);
      }
    });
    return todos;
  }

  public getTodo(lineIndex: number): Todo | null {
    return this.parseTodo(lineIndex, this.lines[lineIndex]);
  }

  private parseTodo(lineIndex: number, line: string): Todo | null {
    const match = MarkdownDocument.todoRegexp.exec(line);
    if (match) {
      return new Todo(
        lineIndex,
        match.groups.prefix,
        match.groups.check === 'x',
        match.groups.suffix,
        match.groups.body);
    }
    return null;
  }

  public modifyTodo(lineIndex: number, edit: TodoEdit) {
    const line = this.lines[lineIndex];
    const todo = this.parseTodo(lineIndex, line);
    if (todo === null) {
      throw `Not a TODO line`;
    }
    if (edit.body !== undefined) {
      todo.body = edit.body;
    }
    if (edit.checked !== undefined) {
      todo.checked = edit.checked;
    }
    const newLine = todo.toMarkdown();
    this.lines[lineIndex] = newLine;
    console.info(
      "Modify TODO: file=%s, index=%d, oldLine=%s, newLine=%s",
      this.file,
      lineIndex,
      line,
      newLine
    );
  }

  public toMarkdown(): string {
    return this.lines.join('\n');
  }
}

export type ReminderTodoEdit = ReminderEdit & {
  checked?: boolean
}

export class Content {
  private doc: MarkdownDocument;

  constructor(file: string, content: string) {
    this.doc = new MarkdownDocument(file, content);
  }

  public getReminders(): Array<Reminder> {
    const reminders: Array<Reminder> = [];
    this.doc.getTodos().forEach(todo => {
      if (todo.checked) {
        return;
      }
      const parsed = REMINDER_FORMAT.parse(this.doc.file, todo.lineIndex, todo.body);
      if (parsed === null) {
        return;
      }
      if (parsed !== null) {
        reminders.push(parsed);
      }
    });
    return reminders;
  }

  public modifyReminderLines(modifyFunc: (reminder: Reminder) => ReminderTodoEdit | null) {
    this.getReminders().forEach(reminder => {
      const edit = modifyFunc(reminder);
      if (edit === null) {
        return;
      }
      this.modifyReminderLine(reminder.rowNumber, edit);
    });
  }

  public updateReminder(reminder: Reminder, edit: ReminderTodoEdit) {
    this.modifyReminderLine(reminder.rowNumber, edit);
  }

  private modifyReminderLine(
    index: number,
    edit: ReminderTodoEdit
  ) {
    const todo = this.doc.getTodo(index);
    const newBody = REMINDER_FORMAT.modify(todo.body, edit);
    if (newBody === null) {
      throw `not a reminder line: ${todo.toMarkdown()}`;
    }
    this.doc.modifyTodo(index, {
      checked: edit.checked,
      body: newBody
    });
  }

  public getContent(): string {
    return this.doc.toMarkdown();
  }
}
