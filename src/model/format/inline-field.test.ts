import {
  appendField,
  parseInlineFields,
  removeField,
  replaceFieldValue,
} from "./inline-field";

describe("parseInlineFields()", (): void => {
  test("bracket style", (): void => {
    const fields = parseInlineFields("Buy milk [due:: 2025-05-17]");
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      key: "due",
      value: "2025-05-17",
      style: "bracket",
      start: 9,
      end: 27,
    });
    expect("Buy milk [due:: 2025-05-17]".slice(9, 27)).toBe(
      "[due:: 2025-05-17]",
    );
  });

  test("paren style", (): void => {
    const fields = parseInlineFields("Buy milk (due:: 2025-05-17T09:00)");
    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      key: "due",
      value: "2025-05-17T09:00",
      style: "paren",
      start: 9,
      end: 33,
    });
  });

  test("multiple fields, in document order", (): void => {
    const fields = parseInlineFields(
      "Task [due:: 2025-05-17] [repeat:: every week]",
    );
    expect(fields.map((f) => f.key)).toEqual(["due", "repeat"]);
    expect(fields.map((f) => f.value)).toEqual(["2025-05-17", "every week"]);
  });

  test("multiple fields with the same key: both are returned, in order", (): void => {
    const fields = parseInlineFields(
      "Task [due:: 2025-05-17] [due:: 2025-06-01]",
    );
    expect(fields.map((f) => f.value)).toEqual(["2025-05-17", "2025-06-01"]);
  });

  test("key is case-sensitive as stored (case-insensitive lookup is a consumer concern)", (): void => {
    const fields = parseInlineFields("Task [DUE:: 2025-05-17]");
    expect(fields[0]!.key).toBe("DUE");
  });

  test("unicode key characters are accepted", (): void => {
    const fields = parseInlineFields("Task [締切:: 2025-05-17]");
    expect(fields[0]!.key).toBe("締切");
  });

  test("value is trimmed of surrounding whitespace inside the delimiters", (): void => {
    const fields = parseInlineFields("Task [due::   2025-05-17   ]");
    expect(fields[0]!.value).toBe("2025-05-17");
  });

  test("no space around :: is accepted", (): void => {
    const fields = parseInlineFields("Task [due::2025-05-17]");
    expect(fields[0]!.value).toBe("2025-05-17");
  });

  test("no fields present", (): void => {
    expect(parseInlineFields("Just a plain task")).toEqual([]);
  });

  test("mismatched delimiters are not a field", (): void => {
    expect(parseInlineFields("Task [due:: 2025-05-17)")).toEqual([]);
    expect(parseInlineFields("Task (due:: 2025-05-17]")).toEqual([]);
  });

  test("key with invalid characters is not a field", (): void => {
    expect(parseInlineFields("Task [du#e:: 2025-05-17]")).toEqual([]);
  });

  test("empty value is accepted", (): void => {
    const fields = parseInlineFields("Task [due::]");
    expect(fields[0]!.value).toBe("");
  });

  test("plain [[wikilink]] is not mistaken for a field", (): void => {
    expect(parseInlineFields("Task [[Some Note]]")).toEqual([]);
  });
});

describe("replaceFieldValue()", (): void => {
  test("bracket style: replaces only the value, preserving everything else", (): void => {
    const text = "Buy milk [due:: 2025-05-17] #tag";
    const field = parseInlineFields(text)[0]!;
    expect(replaceFieldValue(text, field, "2025-06-01")).toBe(
      "Buy milk [due:: 2025-06-01] #tag",
    );
  });

  test("paren style is preserved", (): void => {
    const text = "Buy milk (due:: 2025-05-17)";
    const field = parseInlineFields(text)[0]!;
    expect(replaceFieldValue(text, field, "2025-05-17T09:00")).toBe(
      "Buy milk (due:: 2025-05-17T09:00)",
    );
  });

  test("unusual spacing around :: is preserved", (): void => {
    const text = "Buy milk [due::   2025-05-17   ]";
    const field = parseInlineFields(text)[0]!;
    expect(replaceFieldValue(text, field, "2025-06-01")).toBe(
      "Buy milk [due::   2025-06-01   ]",
    );
  });

  test("no space around :: is preserved", (): void => {
    const text = "Buy milk [due::2025-05-17]";
    const field = parseInlineFields(text)[0]!;
    expect(replaceFieldValue(text, field, "2025-06-01")).toBe(
      "Buy milk [due::2025-06-01]",
    );
  });

  test("replacing one field doesn't disturb another field later in the line", (): void => {
    const text = "Task [due:: 2025-05-17] [repeat:: every week]";
    const dueField = parseInlineFields(text)[0]!;
    const updated = replaceFieldValue(text, dueField, "2025-06-01");
    expect(updated).toBe("Task [due:: 2025-06-01] [repeat:: every week]");
    const repeatField = parseInlineFields(updated)[1]!;
    expect(repeatField.value).toBe("every week");
  });
});

describe("appendField()", (): void => {
  test("appends a bracket-style field with a separating space", (): void => {
    expect(appendField("Buy milk", "due", "2025-05-17")).toBe(
      "Buy milk [due:: 2025-05-17]",
    );
  });

  test("appends a paren-style field when requested", (): void => {
    expect(appendField("Buy milk", "due", "2025-05-17", "paren")).toBe(
      "Buy milk (due:: 2025-05-17)",
    );
  });

  test("doesn't double up a trailing space", (): void => {
    expect(appendField("Buy milk ", "due", "2025-05-17")).toBe(
      "Buy milk [due:: 2025-05-17]",
    );
  });

  test("empty text: no leading separator", (): void => {
    expect(appendField("", "due", "2025-05-17")).toBe("[due:: 2025-05-17]");
  });

  test("round-trips through parseInlineFields()", (): void => {
    const text = appendField("Buy milk", "due", "2025-05-17");
    const fields = parseInlineFields(text);
    expect(fields).toHaveLength(1);
    expect(fields[0]!.key).toBe("due");
    expect(fields[0]!.value).toBe("2025-05-17");
    expect(text.slice(fields[0]!.start, fields[0]!.end)).toBe(
      "[due:: 2025-05-17]",
    );
  });
});

describe("removeField()", (): void => {
  test("removes the field and a preceding separating space", (): void => {
    const text = "Buy milk [due:: 2025-05-17] #tag";
    const field = parseInlineFields(text)[0]!;
    expect(removeField(text, field)).toBe("Buy milk #tag");
  });

  test("removes the field and a following separating space when there's nothing before it", (): void => {
    const text = "[due:: 2025-05-17] Buy milk";
    const field = parseInlineFields(text)[0]!;
    expect(removeField(text, field)).toBe("Buy milk");
  });

  test("removes a field that is the entire text", (): void => {
    const text = "[due:: 2025-05-17]";
    const field = parseInlineFields(text)[0]!;
    expect(removeField(text, field)).toBe("");
  });

  test("removing one field leaves another field's own text intact", (): void => {
    const text = "Task [due:: 2025-05-17] [repeat:: every week]";
    const dueField = parseInlineFields(text)[0]!;
    const updated = removeField(text, dueField);
    expect(updated).toBe("Task [repeat:: every week]");
  });
});
