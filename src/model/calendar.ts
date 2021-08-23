import moment from "moment";

export class Day {
    constructor(public date: moment.Moment) {
    }

    public isToday(date: moment.Moment) {
        if (this.date === undefined) {
            return false;
        }
        return this.date.date() === date.date() && this.date.month() === date.month() && this.date.year() === date.year();
    }

    public isHoliday() {
        return this.date.weekday() === 0 || this.date.weekday() === 6;
    }
}

export class Week {
    public days: Array<Day> = [];
    constructor(private weekStart: moment.Moment) {
        const current = weekStart.clone();
        for (let i: number = 0; i < 7; i++) {
            this.days.push(new Day(current.clone()));
            current.add(1, "day");
        }
    }
}

export class Month {
    public weeks: Array<Week> = [];
    constructor(public monthStart: moment.Moment) {
        let current = monthStart.clone().add(-monthStart.weekday(), "day");
        for (let i: number = 0; i < 6; i++) {
            if (i > 0 && !this.isThisMonth(current)) {
                break;
            }
            this.weeks.push(new Week(current.clone()));
            current.add(1, "week");
        }
    }

    public isThisMonth(date: moment.Moment) {
        return this.monthStart.month() === date.month() && this.monthStart.year() === date.year();
    }
}

export class Calendar {

    private _current: Month;
    public today: moment.Moment;

    constructor(today?: moment.Moment, monthStart?: moment.Moment) {
        if (today) {
            this.today = today;
        } else {
            this.today = moment();
        }

        if (monthStart) {
            this.setCurrent(monthStart);
        } else {
            this.setCurrent(this.today.clone());
        }
    }

    private setCurrent(monthStart: moment.Moment) {
        this._current = new Month(monthStart.clone().set("date", 1));
    }

    public nextMonth() {
        return new Calendar(this.today, this._current.monthStart.clone().add(1, "month"));
    }

    public previousMonth() {
        return new Calendar(this.today, this._current.monthStart.clone().add(-1, "month"));
    }

    public calendarString() {
        let str = `${this._current.monthStart.format("YYYY, MMM")}\nSun Mon Tue Wed Thu Fri Sat\n`;
        this._current.weeks.forEach((week, weekIndex) => {
            let line = " ";
            week.days.forEach((slot, slotIndex) => {
                let s;
                if (slot.date) {
                    if (this._current.isThisMonth(slot.date)) {
                        s = slot.date.format("DD");
                    } else {
                        s = "  ";
                    }
                } else {
                    s = "  ";
                }
                line = line + s + "  ";
            });
            str = str + line + "\n";
        });
        return str;
    }

    get current() {
        return this._current;
    }
}