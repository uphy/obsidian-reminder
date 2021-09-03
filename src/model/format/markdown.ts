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
