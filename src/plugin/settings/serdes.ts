import { Later, Time, parseLaters } from "model/time";
import { ReminderFormatType, ReminderFormatTypes } from "model/format";

/**
 * Serialization/deserialization interface for settings.
 * `R` is the raw value stored in data.json, `E` is the external value used by the plugin.
 */
export interface Serde<R, E> {
  unmarshal(rawValue: R): E;
  marshal(value: E): R;
}

/** Pass-through serde for settings that store their value as-is. */
export class RawSerde<R> implements Serde<R, R> {
  unmarshal(rawValue: R): R {
    return rawValue;
  }
  marshal(value: R): R {
    return value;
  }
}

/** Serde for `Time` values stored as "HH:mm" strings. */
export class TimeSerde implements Serde<string, Time> {
  unmarshal(rawValue: string): Time {
    return Time.parse(rawValue);
  }
  marshal(value: Time): string {
    return value.toString();
  }
}

/** Serde for `Later[]` values stored as newline-separated labels. */
export class LatersSerde implements Serde<string, Array<Later>> {
  unmarshal(rawValue: string): Array<Later> {
    return parseLaters(rawValue);
  }
  marshal(value: Array<Later>): string {
    return value.map((v) => v.label).join("\n");
  }
}

/** Serde for excluded paths stored as newline-separated strings. */
export class ExcludedPathsSerde implements Serde<string, Array<string>> {
  unmarshal(rawValue: string): Array<string> {
    return rawValue
      .split("\n")
      .map((path) => path.trim())
      .filter((path) => path.length > 0);
  }
  marshal(value: Array<string>): string {
    return value.join("\n");
  }
}

/** Serde for reminder format type stored by name. */
export class ReminderFormatTypeSerde implements Serde<
  string,
  ReminderFormatType
> {
  unmarshal(rawValue: string): ReminderFormatType {
    const format = ReminderFormatTypes.find(
      (format) => format.name === rawValue,
    );
    if (format !== undefined) {
      return format;
    }
    console.warn(
      `Unknown reminder format: ${rawValue}. Falling back to the default format.`,
    );
    // ReminderFormatTypes is guaranteed to be non-empty.
    return ReminderFormatTypes[0]!;
  }
  marshal(value: ReminderFormatType): string {
    return value.name;
  }
}
