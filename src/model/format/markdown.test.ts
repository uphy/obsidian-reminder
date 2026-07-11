import { MarkdownDocument, Todo, convertToTodoLine } from "./markdown";

describe("MarkdownDocument", (): void => {
  test("getTodos()", (): void => {
    const md = `# TODO
        
- [ ] Task1 
- [ ] Task2
  * [x] Task2-1
  - [ ]   Task2-2
  -  [ ]   Task2-3
+ [ ] Task3
  + [x] Task3-1
> - [ ] Task in call out
>> - [ ] Task in nested call out
> > - [ ] Task in nested call out2`;

    const doc = new MarkdownDocument("file", md);
    const todos = doc.getTodos();
    expect(todos).toStrictEqual([
      new Todo(2, "- [", " ", "] ", "Task1 "),
      new Todo(3, "- [", " ", "] ", "Task2"),
      new Todo(4, "  * [", "x", "] ", "Task2-1"),
      new Todo(5, "  - [", " ", "]   ", "Task2-2"),
      new Todo(6, "  -  [", " ", "]   ", "Task2-3"),
      new Todo(7, "+ [", " ", "] ", "Task3"),
      new Todo(8, "  + [", "x", "] ", "Task3-1"),
      new Todo(9, "> - [", " ", "] ", "Task in call out"),
      new Todo(10, ">> - [", " ", "] ", "Task in nested call out"),
      new Todo(11, "> > - [", " ", "] ", "Task in nested call out2"),
    ]);

    todos[0]!.body = "New Task1 ";
    todos[0]!.setChecked(true);
    todos[5]!.setChecked(true);
    expect(doc.toMarkdown()).toEqual(`# TODO
        
- [x] New Task1 
- [ ] Task2
  * [x] Task2-1
  - [ ]   Task2-2
  -  [ ]   Task2-3
+ [x] Task3
  + [x] Task3-1
> - [ ] Task in call out
>> - [ ] Task in nested call out
> > - [ ] Task in nested call out2`);

    const todoToInsert = todos[1]!.clone();
    todoToInsert!.body = "Inserted Task";
    doc.insertTodo(2, todoToInsert!);
    expect(doc.toMarkdown()).toEqual(`# TODO
        
- [ ] Inserted Task
- [x] New Task1 
- [ ] Task2
  * [x] Task2-1
  - [ ]   Task2-2
  -  [ ]   Task2-3
+ [x] Task3
  + [x] Task3-1
> - [ ] Task in call out
>> - [ ] Task in nested call out
> > - [ ] Task in nested call out2`);
  });

  test("Cancelled tasks are considered as checked", (): void => {
    const md = `# TODO

- [ ] Undone Task
- [x] Completed Task
- [-] Cancelled Task
`;

    const doc = new MarkdownDocument("file", md);
    const todos = doc.getTodos();
    expect(todos).toStrictEqual([
      new Todo(2, "- [", " ", "] ", "Undone Task"),
      new Todo(3, "- [", "x", "] ", "Completed Task"),
      new Todo(4, "- [", "-", "] ", "Cancelled Task"),
    ]);

    expect(todos[0]!.isChecked()).toBe(false);
    expect(todos[1]!.isChecked()).toBe(true);
    expect(todos[2]!.isChecked()).toBe(true);
  });
});

describe("convertToTodoLine()", (): void => {
  test("already a task list item is returned unchanged", (): void => {
    expect(convertToTodoLine("- [ ] x")).toBe("- [ ] x");
    expect(convertToTodoLine("* [x] x")).toBe("* [x] x");
    expect(convertToTodoLine("> - [ ] x")).toBe("> - [ ] x");
    expect(convertToTodoLine("  - [-] x")).toBe("  - [-] x");
  });

  test("plain text is prefixed with a checkbox", (): void => {
    expect(convertToTodoLine("Task1")).toBe("- [ ] Task1");
    expect(convertToTodoLine("Task with #tag and [[Link]] and **bold**")).toBe(
      "- [ ] Task with #tag and [[Link]] and **bold**",
    );
  });

  test("empty line becomes an empty task", (): void => {
    expect(convertToTodoLine("")).toBe("- [ ] ");
  });

  test("indentation is preserved", (): void => {
    expect(convertToTodoLine("  Task1")).toBe("  - [ ] Task1");
    expect(convertToTodoLine("\tTask1")).toBe("\t- [ ] Task1");
  });

  test("quote markers are preserved", (): void => {
    expect(convertToTodoLine("> foo")).toBe("> - [ ] foo");
    expect(convertToTodoLine("> > foo")).toBe("> > - [ ] foo");
    expect(convertToTodoLine(">> foo")).toBe(">> - [ ] foo");
  });

  test("bullet items get a checkbox inserted after the marker", (): void => {
    expect(convertToTodoLine("- foo")).toBe("- [ ] foo");
    expect(convertToTodoLine("* foo")).toBe("* [ ] foo");
    expect(convertToTodoLine("+ foo")).toBe("+ [ ] foo");
    expect(convertToTodoLine("  - foo")).toBe("  - [ ] foo");
    expect(convertToTodoLine("> - foo")).toBe("> - [ ] foo");
    expect(convertToTodoLine("- ")).toBe("- [ ] ");
  });

  test("headings are not converted", (): void => {
    expect(convertToTodoLine("# Heading")).toBeNull();
    expect(convertToTodoLine("###### Heading")).toBeNull();
    expect(convertToTodoLine("> # Heading")).toBeNull();
  });

  test("numbered list items are not converted (see #258)", (): void => {
    expect(convertToTodoLine("1. foo")).toBeNull();
    expect(convertToTodoLine("2) bar")).toBeNull();
  });

  test("table rows are not converted", (): void => {
    expect(convertToTodoLine("| a | b |")).toBeNull();
  });

  test("code fence lines are not converted", (): void => {
    expect(convertToTodoLine("```")).toBeNull();
    expect(convertToTodoLine("```ts")).toBeNull();
  });

  test("every non-null result is parseable by Todo.parse()", (): void => {
    const lines = [
      "- [ ] x",
      "* [x] x",
      "> - [ ] x",
      "Task1",
      "Task with #tag and [[Link]] and **bold**",
      "",
      "  Task1",
      "\tTask1",
      "> foo",
      "> > foo",
      ">> foo",
      "- foo",
      "* foo",
      "+ foo",
      "  - foo",
      "> - foo",
      "- ",
      "# Heading",
      "###### Heading",
      "> # Heading",
      "1. foo",
      "2) bar",
      "| a | b |",
      "```",
      "```ts",
    ];
    for (const line of lines) {
      const converted = convertToTodoLine(line);
      if (converted !== null) {
        expect(Todo.parse(0, converted)).not.toBeNull();
      }
    }
  });
});
