import type { Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import { App, Modal, Platform } from "obsidian";
import DateTimeChooser from "ui/DateTimeChooser.svelte";

class DateTimeChooserModal extends Modal {
  private selected?: DateTime;

  constructor(
    app: App,
    private reminders: Reminders,
    private onSelect: (value: DateTime) => void,
    private onCancel: () => void,
    private timeStep: number,
    private initialTime?: DateTime,
  ) {
    super(app);
  }

  override onOpen() {
    let targetElement: HTMLElement;
    if (Platform.isDesktop) {
      this.modalEl.style.minWidth = "0px";
      this.modalEl.style.minHeight = "0px";
      this.modalEl.style.width = "auto";
      targetElement = this.contentEl;
    } else {
      targetElement = this.containerEl;
    }

    new DateTimeChooser({
      target: targetElement,
      props: {
        onSelect: (time: DateTime) => {
          this.select(time);
        },
        reminders: this.reminders,
        timeStep: this.timeStep,
        initialTime: this.initialTime,
      },
    });
  }

  private select(time: DateTime) {
    this.selected = time;
    this.close();
  }

  override onClose() {
    if (this.selected != null) {
      this.onSelect(this.selected);
    } else {
      this.onCancel();
    }
  }
}

export function showDateTimeChooserModal(
  app: App,
  reminders: Reminders,
  timeStep: number = 15,
  initialTime?: DateTime,
): Promise<DateTime> {
  return new Promise((resolve, reject) => {
    const modal = new DateTimeChooserModal(
      app,
      reminders,
      resolve,
      reject,
      timeStep,
      initialTime,
    );
    modal.open();
  });
}
