import { MarkdownDocument, Todo } from './markdown';

describe('MarkdownDocument', (): void => {
  test('getTodos()', (): void => {
    const md = `# TODO
        
- [ ] Task1 
- [ ] Task2
  * [x] Task2-1
  - [ ]   Task2-2
  -  [ ]   Task2-3
> - [ ] Task in call out
>> - [ ] Task in nested call out
> > - [ ] Task in nested call out2`;

    const doc = new MarkdownDocument('file', md);
    const todos = doc.getTodos();
    expect(todos).toStrictEqual([
      new Todo(2, '- [', ' ', '] ', 'Task1 '),
      new Todo(3, '- [', ' ', '] ', 'Task2'),
      new Todo(4, '  * [', 'x', '] ', 'Task2-1'),
      new Todo(5, '  - [', ' ', ']   ', 'Task2-2'),
      new Todo(6, '  -  [', ' ', ']   ', 'Task2-3'),
      new Todo(7, '> - [', ' ', '] ', 'Task in call out'),
      new Todo(8, '>> - [', ' ', '] ', 'Task in nested call out'),
      new Todo(9, '> > - [', ' ', '] ', 'Task in nested call out2'),
    ]);

    todos[0]!.body = 'New Task1 ';
    todos[0]!.setChecked(true);
    expect(doc.toMarkdown()).toEqual(`# TODO
        
- [x] New Task1 
- [ ] Task2
  * [x] Task2-1
  - [ ]   Task2-2
  -  [ ]   Task2-3
> - [ ] Task in call out
>> - [ ] Task in nested call out
> > - [ ] Task in nested call out2`);

    const todoToInsert = todos[1]!.clone();
    todoToInsert!.body = 'Inserted Task';
    doc.insertTodo(2, todoToInsert!);
    expect(doc.toMarkdown()).toEqual(`# TODO
        
- [ ] Inserted Task
- [x] New Task1 
- [ ] Task2
  * [x] Task2-1
  - [ ]   Task2-2
  -  [ ]   Task2-3
> - [ ] Task in call out
>> - [ ] Task in nested call out
> > - [ ] Task in nested call out2`);
  });

  test('Cancelled tasks are considered as checked', (): void => {
    const md = `# TODO

- [ ] Undone Task
- [x] Completed Task
- [-] Cancelled Task
`;

    const doc = new MarkdownDocument('file', md);
    const todos = doc.getTodos();
    expect(todos).toStrictEqual([
      new Todo(2, '- [', ' ', '] ', 'Undone Task'),
      new Todo(3, '- [', 'x', '] ', 'Completed Task'),
      new Todo(4, '- [', '-', '] ', 'Cancelled Task'),
    ]);

    expect(todos[0]!.isChecked()).toBe(false);
    expect(todos[1]!.isChecked()).toBe(true);
    expect(todos[2]!.isChecked()).toBe(true);
  });
});
