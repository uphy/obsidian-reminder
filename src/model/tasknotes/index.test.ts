import { moment } from "model/moment";
import { DateTime } from "model/time";
import type { TaskNotesContext, TaskNotesOptions } from "./types";
import { DEFAULT_TASKNOTES_PROPERTIES, extractReminders } from "./index";

const defaultOptions: TaskNotesOptions = {
  identificationMode: "tag",
  tag: "task",
  identificationProperty: "type",
  identificationValue: "task",
  excludedFolders: [],
  properties: DEFAULT_TASKNOTES_PROPERTIES,
  completedStatuses: ["done"],
  skipCompleted: true,
  skipArchived: true,
  archiveTag: "archived",
  skipRecurringInstances: true,
  dateOnlyAnchorTime: "00:00",
  ignoreOlderThanDays: 1,
};

function context(
  options: Partial<TaskNotesOptions> = {},
  filePath: string = "Tasks/Prepare release.md",
): TaskNotesContext {
  return {
    filePath,
    fileName: "Prepare release",
    tags: ["#task"],
    options: { ...defaultOptions, ...options },
    now: DateTime.parse("2026-11-10 12:00"),
  };
}

function extract(
  frontmatter: Record<string, unknown>,
  options: Partial<TaskNotesOptions> = {},
) {
  return extractReminders(frontmatter, context(options));
}

function reminder(id: string, relatedTo: "due" | "scheduled", offset: string) {
  return { id, type: "relative", relatedTo, offset };
}

describe("extractReminders()", (): void => {
  test("does not warn when a tagged task has no reminders property", (): void => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(extract({ due: "2026-11-20T14:30" })).toHaveLength(0);
      expect(warning).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  test("resolves the TaskNotes due and scheduled reminder examples", (): void => {
    const reminders = extract({
      due: "2026-11-20T14:30",
      scheduled: "2026-11-18T09:00",
      reminders: [
        reminder("rem_1794200801440_y7l2fwpz5", "due", "-P0D"),
        reminder("rem_1794200801440_6bu6366kw", "scheduled", "-PT0M"),
      ],
    });

    expect(reminders.map((item) => item.time.toString())).toEqual([
      "2026-11-18 09:00",
      "2026-11-20 14:30",
    ]);
  });

  [
    {
      name: "datetime anchor and negative minutes",
      anchor: "2026-11-20T14:30",
      offset: "-PT15M",
      expected: "2026-11-20 14:15",
    },
    {
      name: "date-only anchor at midnight",
      anchor: "2026-11-20",
      offset: "-P0D",
      expected: "2026-11-20 00:00",
    },
    {
      name: "date-only anchor at custom time",
      anchor: "2026-11-20",
      offset: "-P0D",
      expected: "2026-11-20 07:45",
      customTime: "07:45",
    },
    {
      name: "positive minutes",
      anchor: "2026-11-20T14:30",
      offset: "PT30M",
      expected: "2026-11-20 15:00",
    },
    {
      name: "positive week",
      anchor: "2026-11-20T14:30",
      offset: "P1W",
      expected: "2026-11-27 14:30",
    },
  ].forEach(({ name, anchor, offset, expected, customTime }) => {
    test(`resolves ${name}`, (): void => {
      const reminders = extract(
        { due: anchor, reminders: [reminder("offset-test", "due", offset)] },
        customTime ? { dateOnlyAnchorTime: customTime } : {},
      );

      expect(reminders[0]?.time.toString()).toBe(expected);
    });
  });

  test("uses the configured local time for date-only YAML Date values", (): void => {
    const dateOnly = new Date("2026-11-20T00:00:00.000Z");
    const defaultReminder = extract({
      due: dateOnly,
      reminders: [reminder("date-object-default", "due", "-P0D")],
    })[0];
    const customReminder = extract(
      {
        due: dateOnly,
        reminders: [reminder("date-object-custom", "due", "-P0D")],
      },
      { dateOnlyAnchorTime: "07:45" },
    )[0];

    expect(defaultReminder?.time.toString()).toBe("2026-11-20 00:00");
    expect(customReminder?.time.toString()).toBe("2026-11-20 07:45");
  });

  [
    ["UTC", "2026-11-19T08:00:00Z"],
    ["numeric offset", "2026-11-19T08:00:00+05:30"],
    ["local datetime", "2026-11-19T08:00:00"],
  ].forEach(([name, absoluteTime]) => {
    test(`resolves absolute reminders with ${name}`, (): void => {
      const [result] = extract({
        reminders: [{ id: `absolute-${name}`, type: "absolute", absoluteTime }],
      });

      expect(result?.time.moment().valueOf()).toBe(
        moment(absoluteTime, moment.ISO_8601, true).valueOf(),
      );
      expect(result?.tasknotes?.anchor.type).toBe("absolute");
    });
  });

  test("skips invalid durations without throwing", (): void => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      ["15M", "P", "PT", "-P1X", ""].forEach((offset) => {
        const reminders = extract({
          due: "2026-11-20T14:30",
          reminders: [reminder(`bad-${offset || "empty"}`, "due", offset)],
        });

        expect(reminders).toHaveLength(0);
      });
    } finally {
      warning.mockRestore();
    }
  });

  test("rejects numeric durations without throwing", (): void => {
    expect(
      extract({
        due: "2026-11-20T14:30",
        reminders: [
          {
            id: "numeric-duration",
            type: "relative",
            relatedTo: "due",
            offset: 15,
          },
        ],
      }),
    ).toHaveLength(0);
  });

  test("warns only once for the same file and reminder id", (): void => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const ctx = context();
      const frontmatter = {
        due: "2026-11-20T14:30",
        reminders: [reminder("warning-once-regression", "due", "15M")],
      };
      extractReminders(frontmatter, ctx);
      extractReminders(frontmatter, ctx);

      expect(warning).toHaveBeenCalledTimes(1);
    } finally {
      warning.mockRestore();
    }
  });

  test("skips a missing anchor, duplicate ids, and mixed type fields", (): void => {
    const warnings = new Set<string>();
    const ctx = context();
    ctx.warnOnce = (key) => warnings.add(key);
    const reminders = extractReminders(
      {
        reminders: [
          reminder("missing-anchor", "due", "-PT15M"),
          {
            id: "mixed-fields",
            type: "absolute",
            absoluteTime: "2026-11-19T08:00:00",
            relatedTo: "due",
            offset: "-P0D",
          },
          {
            id: "duplicate-id",
            type: "absolute",
            absoluteTime: "2026-11-19T08:00:00",
            description: "first",
          },
          {
            id: "duplicate-id",
            type: "absolute",
            absoluteTime: "2026-11-20T08:00:00",
            description: "second",
          },
        ],
      },
      ctx,
    );

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.tasknotes?.description).toBe("first");
    expect(warnings.size).toBe(3);
  });

  test("sorts by trigger and then reminder id", (): void => {
    const reminders = extract({
      due: "2026-11-20T14:30",
      reminders: [
        reminder("same-z", "due", "-PT15M"),
        reminder("later", "due", "PT30M"),
        reminder("same-a", "due", "-PT15M"),
      ],
    });

    expect(reminders.map((item) => item.tasknotes?.reminderId)).toEqual([
      "same-a",
      "same-z",
      "later",
    ]);
  });

  test("skips completed tasks by status, boolean status, and completedDate", (): void => {
    const reminderList = [reminder("done", "due", "-P0D")];
    expect(
      extract({ status: "done", due: "2026-11-20", reminders: reminderList }),
    ).toHaveLength(0);
    expect(
      extract({ status: true, due: "2026-11-20", reminders: reminderList }),
    ).toHaveLength(0);
    expect(
      extract({
        completedDate: "2026-11-09",
        due: "2026-11-20",
        reminders: reminderList,
      }),
    ).toHaveLength(0);
  });

  test("only treats completedDate as complete for non-recurring tasks", (): void => {
    expect(
      extract({
        completedDate: "2026-11-09",
        recurrence: "FREQ=WEEKLY",
        due: "2026-11-20",
        reminders: [reminder("recurring", "due", "-P0D")],
      }),
    ).toHaveLength(1);
  });

  test("skips archived and completed recurring instances", (): void => {
    const reminderList = [reminder("skip", "due", "-P0D")];
    const archivedContext = context({ skipArchived: true });
    archivedContext.tags = ["#archived"];
    expect(
      extractReminders(
        { due: "2026-11-20", reminders: reminderList },
        archivedContext,
      ),
    ).toHaveLength(0);
    expect(
      extract(
        {
          recurrence: "FREQ=WEEKLY",
          due: "2026-11-20",
          complete_instances: ["2026-11-20"],
          reminders: reminderList,
        },
        { skipRecurringInstances: true },
      ),
    ).toHaveLength(0);
    expect(
      extract({
        recurrence: "FREQ=WEEKLY",
        due: "2026-11-20",
        skipped_instances: ["2026-11-20"],
        reminders: reminderList,
      }),
    ).toHaveLength(0);
  });

  test("supports tag, property, and valid-reminders identification with exclusions", (): void => {
    const frontmatter = {
      type: "work",
      deadline: "2026-11-20",
      alerts: [reminder("custom", "due", "-P0D")],
    };
    const properties = {
      ...DEFAULT_TASKNOTES_PROPERTIES,
      reminders: "alerts",
      due: "deadline",
    };
    expect(
      extractReminders(frontmatter, {
        ...context({
          identificationMode: "property",
          identificationProperty: "type",
          identificationValue: "work",
          properties,
        }),
        tags: [],
      }),
    ).toHaveLength(1);
    expect(
      extractReminders(frontmatter, {
        ...context({
          identificationMode: "property",
          identificationProperty: "type",
          identificationValue: "",
          properties,
          excludedFolders: ["Archive"],
        }),
        tags: [],
        filePath: "Archive/Task.md",
      }),
    ).toHaveLength(0);
    expect(
      extractReminders(frontmatter, {
        ...context({
          identificationMode: "reminders",
          properties,
          excludedFolders: ["Archive"],
        }),
        tags: [],
        filePath: "Tasks/Task.md",
      }),
    ).toHaveLength(1);
    expect(
      extractReminders(frontmatter, {
        ...context({
          identificationMode: "reminders",
          properties,
          excludedFolders: ["Tasks"],
        }),
        tags: [],
        filePath: "Tasks/Task.md",
      }),
    ).toHaveLength(0);
  });

  test("matches configured property values against array elements", (): void => {
    const options: Partial<TaskNotesOptions> = {
      identificationMode: "property",
      identificationProperty: "type",
      identificationValue: "ai",
    };
    const reminders = [reminder("array-property", "due", "-P0D")];
    const base = { due: "2026-11-20", reminders };

    expect(extract({ ...base, type: ["task", "AI"] }, options)).toHaveLength(1);
    expect(extract({ ...base, type: ["other"] }, options)).toHaveLength(0);
    expect(
      extract(
        { ...base, type: ["task", "AI"] },
        { ...options, identificationValue: "" },
      ),
    ).toHaveLength(1);
  });

  test("ignores triggers older than the flood-guard window", (): void => {
    expect(
      extract(
        {
          due: "2026-11-01T09:00",
          reminders: [reminder("historic", "due", "-P0D")],
        },
        { ignoreOlderThanDays: 1 },
      ),
    ).toHaveLength(0);
  });

  test("applies the flood guard to the snooze effective time", (): void => {
    const trigger = DateTime.parse("2026-11-01 09:00");
    const futureSnooze = DateTime.parse("2026-11-20 09:00");
    const pastSnooze = DateTime.parse("2026-11-08 09:00");
    const base = {
      due: "2026-11-01T09:00",
      reminders: [reminder("snoozed-old-trigger", "due", "-P0D")],
    };

    const retained = extractReminders(base, {
      ...context({ ignoreOlderThanDays: 1 }),
      effectiveTimeFor: (_id, originalTrigger) => {
        expect(originalTrigger.equals(trigger)).toBe(true);
        return futureSnooze;
      },
    });
    const suppressed = extractReminders(base, {
      ...context({ ignoreOlderThanDays: 1 }),
      effectiveTimeFor: () => pastSnooze,
    });

    expect(retained).toHaveLength(1);
    expect(retained[0]?.effectiveTime.equals(futureSnooze)).toBe(true);
    expect(suppressed).toHaveLength(0);
  });

  test("uses calendar-aware subtraction across a daylight-saving transition", (): void => {
    const oldTimezone = process.env["TZ"];
    process.env["TZ"] = "America/New_York";
    try {
      const anchor = moment("2026-03-09T12:00:00-04:00", moment.ISO_8601, true);
      const expected = anchor.clone().subtract(1, "day");
      const ctx = context({ ignoreOlderThanDays: 500 });
      ctx.now = DateTime.parse("2026-03-10 12:00");
      const [result] = extractReminders(
        {
          due: "2026-03-09T12:00:00-04:00",
          reminders: [reminder("dst", "due", "-P1D")],
        },
        ctx,
      );

      expect(result?.time.moment().valueOf()).toBe(expected.valueOf());
      if (anchor.utcOffset() !== expected.utcOffset()) {
        expect(expected.diff(anchor, "hours")).toBe(-23);
      }
    } finally {
      if (oldTimezone === undefined) {
        delete process.env["TZ"];
      } else {
        process.env["TZ"] = oldTimezone;
      }
    }
  });
});
