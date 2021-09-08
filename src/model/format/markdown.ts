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
    private static readonly regexp = /^(?<prefix>\s*\- \[)(?<check>.)(?<suffix>\]\s+)(?<body>.*)$/;

    static parse(lineIndex: number, line: string): Todo | null {
        const match = Todo.regexp.exec(line);
        if (match) {
            return new Todo(
                lineIndex,
                match.groups.prefix,
                match.groups.check,
                match.groups.suffix,
                match.groups.body);
        }
        return null;
    }

    constructor(
        public lineIndex: number,
        private prefix: string,
        public check: string,
        private suffix: string,
        public body: string) { }

    public toMarkdown(): string {
        return `${this.prefix}${this.check}${this.suffix}${this.body}`;
    }

    public isChecked() {
        return this.check === 'x';
    }

    public setChecked(checked: boolean) {
        this.check = checked ? 'x' : ' ';
    }
}

export type TodoEdit = {
    checked?: boolean,
    body?: string,
}

export class MarkdownDocument {

    private lines: Array<string>;
    private todos: Array<Todo>;

    constructor(public file: string, content: string) {
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

    public getTodo(lineIndex: number): Todo | null {
        const found = this.todos.filter(todo => todo.lineIndex === lineIndex);
        if (found.length === 0) {
            return null;
        }
        return found[0];
    }

    public toMarkdown(): string {
        // apply changes of TODO items to lines
        this.todos.forEach(todo => {
            this.lines[todo.lineIndex] = todo.toMarkdown();
        });
        // join lines
        return this.lines.join('\n');
    }
}
