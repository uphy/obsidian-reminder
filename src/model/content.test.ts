import { MarkdownDocument, Todo } from "./content";

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
                new Todo(2, '- [', false, '] ', 'Task1 '),
                new Todo(3, '- [', false, '] ', 'Task2'),
                new Todo(4, '  - [', true, '] ', 'Task2-1'),
                new Todo(5, '  - [', false, ']   ', 'Task2-2')
            ]);

        doc.modifyTodo(2, { checked: true, body: "New Task1 " })
        expect(doc.toMarkdown()).toEqual(`# TODO
        
- [x] New Task1 
- [ ] Task2
  - [x] Task2-1
  - [ ]   Task2-2`);
    });
})
