/**
 * A small tokenizer for Dataview-style inline fields on a single line, e.g.
 * `[due:: 2025-05-17]` or `(due:: 2025-05-17T09:00)`.
 *
 * This is the analogue of `splitter.ts` for the Dataview format: it doesn't
 * know anything about reminders, dates, or the Tasks plugin. It only
 * recognizes the generic `[key:: value]` / `(key:: value)` shape and gives
 * callers exact original-text coordinates so a caller-side `computeSpan()`
 * can point at the right place in the editor.
 *
 * Key match is case-sensitive here: this module stores the key exactly as
 * written. Callers that need case-insensitive lookups (Dataview itself
 * normalizes keys) should lowercase both sides when comparing.
 */

export type InlineFieldStyle = "bracket" | "paren";

export type InlineField = {
  /** The field key, exactly as written (not case-normalized). */
  key: string;
  /** The field value, with surrounding whitespace (inside the delimiters) trimmed. */
  value: string;
  /** Whether the field was written as `[key:: value]` or `(key:: value)`. */
  style: InlineFieldStyle;
  /** Start index (inclusive) of the whole field, in original-text UTF-16 coordinates. */
  start: number;
  /** End index (exclusive) of the whole field, in original-text UTF-16 coordinates. */
  end: number;
};

// Decomposes a field into its structural parts so that `replaceFieldValue`
// can splice in a new value while preserving everything else byte-for-byte
// (including any unusual spacing around `::` that a user may have written).
//
//   open   pre       key            mid  value                 post      close
//   [/(    \s*   [\p{L}\p{N}_-]+   ::  \s*   [^[\]()]* (lazy)   \s*      ]/)
const INLINE_FIELD_SOURCE =
  "(?<open>[[(])(?<pre>\\s*)(?<key>[\\p{L}\\p{N}_-]+)::(?<mid>\\s*)(?<value>[^[\\]()]*?)(?<post>\\s*)(?<close>[)\\]])";

function matchesStyle(open: string, close: string): InlineFieldStyle | null {
  if (open === "[" && close === "]") {
    return "bracket";
  }
  if (open === "(" && close === ")") {
    return "paren";
  }
  // Mismatched delimiters (e.g. `[due:: 2025-05-17)`) are not a valid field.
  return null;
}

/**
 * Parse all inline fields out of `text`, in original-text coordinates.
 *
 * Fields are matched independently of each other (no nesting support is
 * needed for task metadata); when the same key appears multiple times, all
 * occurrences are returned in document order, and it's up to the caller to
 * decide that "the first one wins" where that matters.
 */
export function parseInlineFields(text: string): InlineField[] {
  const regexp = new RegExp(INLINE_FIELD_SOURCE, "gu");
  const fields: InlineField[] = [];
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(text)) !== null) {
    const groups = match.groups!;
    const style = matchesStyle(groups["open"]!, groups["close"]!);
    if (style == null) {
      continue;
    }
    fields.push({
      key: groups["key"]!,
      value: groups["value"]!,
      style,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return fields;
}

/**
 * Replace the value of `field` (previously returned by `parseInlineFields`
 * on this exact `text`) with `newValue`, preserving the delimiters, key,
 * and any whitespace around `::` byte-for-byte.
 */
export function replaceFieldValue(
  text: string,
  field: InlineField,
  newValue: string,
): string {
  const fieldText = text.slice(field.start, field.end);
  const regexp = new RegExp(`^${INLINE_FIELD_SOURCE}$`, "u");
  const match = regexp.exec(fieldText);
  if (match == null) {
    // Shouldn't happen for a field that came from parseInlineFields() on
    // this same text, but fail safe by leaving the text untouched.
    return text;
  }
  const groups = match.groups!;
  const prefixLength =
    groups["open"]!.length +
    groups["pre"]!.length +
    groups["key"]!.length +
    2 /* "::" */ +
    groups["mid"]!.length;
  const valueLength = groups["value"]!.length;
  const newFieldText =
    fieldText.slice(0, prefixLength) +
    newValue +
    fieldText.slice(prefixLength + valueLength);
  return text.slice(0, field.start) + newFieldText + text.slice(field.end);
}

/**
 * Append a new field `[key:: value]` (or `(key:: value)` for `style ===
 * "paren"`) at the end of `text`, matching what the Tasks plugin itself
 * writes: a single separating space is inserted when `text` doesn't already
 * end with whitespace, and nothing is inserted when `text` is empty.
 */
export function appendField(
  text: string,
  key: string,
  value: string,
  style: InlineFieldStyle = "bracket",
): string {
  const [open, close] = style === "bracket" ? ["[", "]"] : ["(", ")"];
  const fieldText = `${open}${key}:: ${value}${close}`;
  if (text.length === 0) {
    return fieldText;
  }
  const separator = /\s$/.test(text) ? "" : " ";
  return `${text}${separator}${fieldText}`;
}

/**
 * Remove `field` (previously returned by `parseInlineFields` on this exact
 * `text`) from `text`, also trimming one adjacent separating space (if any)
 * so removal doesn't leave a double space behind.
 */
export function removeField(text: string, field: InlineField): string {
  let start = field.start;
  let end = field.end;
  if (start > 0 && text[start - 1] === " ") {
    start -= 1;
  } else if (end < text.length && text[end] === " ") {
    end += 1;
  }
  return text.slice(0, start) + text.slice(end);
}
