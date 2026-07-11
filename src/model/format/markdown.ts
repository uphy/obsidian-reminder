/**
 * Represents TODO items in Markdown.
 *
 * This class shouldn't break original line.
 */
export class Todo {
  // e.g: '  - [x] hello'
  // prefix: '  - [ '
  // check: 'x'
  // suffix: '] '
  // body: hello
  private static readonly regexp =
    /^(?<prefix>((> ?)*)?\s*[-*+][ ]+\[)(?<check>.)(?<suffix>\]\s+)(?<body>.*)$/;
  private static readonly checkedStatuses = ["x", "-"];

  static parse(lineIndex: number, line: string): Todo | null {
    const match = Todo.regexp.exec(line);
    if (match) {
      return new Todo(
        lineIndex,
        match.groups!["prefix"]!,
        match.groups!["check"]!,
        match.groups!["suffix"]!,
        match.groups!["body"]!,
      );
    }
    return null;
  }

  constructor(
    public lineIndex: number,
    private prefix: string,
    public check: string,
    private suffix: string,
    public body: string,
  ) {}

  public toMarkdown(): string {
    return `${this.prefix}${this.check}${this.suffix}${this.body}`;
  }

  public isChecked() {
    return Todo.checkedStatuses.some((status) => status === this.check);
  }

  public setChecked(checked: boolean) {
    this.check = checked ? "x" : " ";
  }

  public getHeaderLength() {
    return this.prefix.length + this.check.length + this.suffix.length;
  }

  public clone() {
    return Todo.parse(this.lineIndex, this.toMarkdown());
  }
}

/**
 * Converts a line that isn't a task list item into an unchecked todo line
 * ("- [ ] ...") so a reminder can be inserted into it.
 *
 * Returns the line unchanged if `Todo.parse()` already accepts it.  Returns
 * `null` when the line shouldn't be converted (heading, numbered list item,
 * table row, code fence) — converting these would either surprise the user
 * or produce a line the parser can't read back.
 *
 * For every non-null result, `Todo.parse(0, result)` is guaranteed to
 * succeed.
 */
export function convertToTodoLine(line: string): string | null {
  if (Todo.parse(0, line) !== null) {
    return line;
  }

  // Split off the leading block prefix (quote markers + indentation) that
  // Todo.regexp also allows before the bullet marker, so it survives the
  // conversion untouched.
  const match = /^(?<lead>(?:> ?)*\s*)(?<rest>.*)$/.exec(line)!;
  const lead = match.groups!["lead"]!;
  const rest = match.groups!["rest"]!;

  if (/^#{1,6}[ ]/.test(rest)) {
    // Heading
    return null;
  }
  if (/^\d+[.)][ ]/.test(rest)) {
    // Numbered list item. Converting this to a checkbox would produce a
    // line the parser can't read back (see #258 for numbered-list task
    // support).
    return null;
  }
  if (rest.startsWith("|")) {
    // Table row
    return null;
  }
  if (rest.startsWith("```")) {
    // Code fence
    return null;
  }

  const bulletMatch = /^(?<marker>[-*+])[ ]+(?<content>.*)$/.exec(rest);
  if (bulletMatch) {
    const marker = bulletMatch.groups!["marker"]!;
    const content = bulletMatch.groups!["content"]!;
    return `${lead}${marker} [ ] ${content}`;
  }

  // Empty or plain text (including inline markdown like tags/links/bold).
  return `${lead}- [ ] ${rest}`;
}

export type TodoEdit = {
  checked?: boolean;
  body?: string;
};

export class MarkdownDocument {
  private lines: Array<string> = [];
  private todos: Array<Todo> = [];

  constructor(
    public file: string,
    content: string,
  ) {
    this.parse(content);
  }

  private parse(content: string) {
    this.lines = content.split("\n");
    this.todos = [];
    this.lines.forEach((line, lineIndex) => {
      const todo = Todo.parse(lineIndex, line);
      if (todo) {
        this.todos.push(todo);
      }
    });
  }

  public getTodos(): Array<Todo> {
    return this.todos;
  }

  public insertTodo(lineIndex: number, todo: Todo) {
    todo.lineIndex = lineIndex;
    this.lines.splice(lineIndex, 0, todo.toMarkdown());
    let todoIndex = -1;
    for (const i in this.todos) {
      const todo = this.todos[i]!;
      if (todo.lineIndex >= lineIndex) {
        if (todoIndex < 0) {
          todoIndex = parseInt(i);
        }
        todo.lineIndex++;
      }
    }
    if (todoIndex <= 0) {
      this.todos.splice(0, 0, todo);
    } else {
      this.todos.splice(todoIndex, 0, todo);
    }
  }

  public getTodo(lineIndex: number): Todo | null {
    const found = this.todos.find((todo) => todo.lineIndex === lineIndex);
    if (found == null) {
      return null;
    }
    return found;
  }

  private applyChanges() {
    // apply changes of TODO items to lines
    this.todos.forEach((todo) => {
      this.lines[todo.lineIndex] = todo.toMarkdown();
    });
  }

  public toMarkdown(): string {
    this.applyChanges();
    return this.lines.join("\n");
  }
}
