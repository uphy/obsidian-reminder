import { DateTime } from "model/time";
import moment from "moment";
import { ReminderFormatParameterKey, ReminderStatus } from "./reminder-base";
import { ReminderFormatTestUtil } from "./reminder-base.test";
import { DefaultReminderFormat } from "./reminder-default";

describe('DefaultReminderFormat', (): void => {
    const util = new ReminderFormatTestUtil(() => new DefaultReminderFormat());
    test("parse", (): void => {
        util.testParse({
            inputMarkdown: "- [ ] Task1 (@2021-09-14)",
            expectedTime: "2021-09-14",
            expectedTitle: "Task1",
            configFunc: (config) => {
                config.setParameterValue(ReminderFormatParameterKey.linkDatesToDailyNotes, false);
            }
        });
        util.testParse({
            inputMarkdown: "- [ ] Task1 (@2021-09-14 10:00)",
            expectedTime: "2021-09-14 10:00",
            expectedTitle: "Task1",
            configFunc: (config) => {
                config.setParameterValue(ReminderFormatParameterKey.linkDatesToDailyNotes, false);
            }
        });
    });
    test("parse - link dates to daily notes", (): void => {
        util.testParse({
            inputMarkdown: "- [ ] Task1 (@[[2021-09-14]] 10:00)",
            expectedTime: "2021-09-14 10:00",
            expectedTitle: "Task1",
            configFunc: (config) => {
                config.setParameterValue(ReminderFormatParameterKey.linkDatesToDailyNotes, true);
            }
        });
        util.testParse({
            inputMarkdown: "- [ ] Task1 (@[[2021-09-14]])",
            expectedTime: "2021-09-14",
            expectedTitle: "Task1",
            configFunc: (config) => {
                config.setParameterValue(ReminderFormatParameterKey.linkDatesToDailyNotes, true);
            }
        });
    });
    test("modify", async () => {
        await util.testModify({
            inputMarkdown: "- [ ] Task1 (@2021-09-14)",
            edit: {
                status: ReminderStatus.Done,
                time: new DateTime(moment("2021-09-15 10:00"), true)
            },
            expectedMarkdown: "- [x] Task1 (@2021-09-15 10:00)",
            configFunc: (config) => {
                config.setParameterValue(ReminderFormatParameterKey.linkDatesToDailyNotes, false);
            }
        })
    });
    test("modify - link dates to daily notes", async () => {
        await util.testModify({
            inputMarkdown: "- [ ] Task1 (@[[2021-09-14]] 09:00)",
            edit: {
                status: ReminderStatus.Done,
                time: new DateTime(moment("2021-09-15 10:00"), true)
            },
            expectedMarkdown: "- [x] Task1 (@[[2021-09-15]] 10:00)",
            configFunc: (config) => {
                config.setParameterValue(ReminderFormatParameterKey.linkDatesToDailyNotes, true);
            }
        })
    });
});
