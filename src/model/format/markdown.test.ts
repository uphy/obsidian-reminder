import { MarkdownDocument, Todo } from "./markdown";

describe('MarkdownDocument', (): void => {
    test('getTodos()', (): void => {
        const md = `# TODO
        
- [ ] Task1 
- [ ] Task2
  - [x] Task2-1
  - [ ]   Task2-2`;

        const doc = new MarkdownDocument("file", md);
        const todos = doc.getTodos();
        expect(todos)
            .toStrictEqual([
                new Todo(2, '- [', " ", '] ', 'Task1 '),
                new Todo(3, '- [', " ", '] ', 'Task2'),
                new Todo(4, '  - [', "x", '] ', 'Task2-1'),
                new Todo(5, '  - [', " ", ']   ', 'Task2-2')
            ]);

        todos[0].body = "New Task1 ";
        todos[0].setChecked(true);
        expect(doc.toMarkdown()).toEqual(`# TODO
        
- [x] New Task1 
- [ ] Task2
  - [x] Task2-1
  - [ ]   Task2-2`);
    });
})
