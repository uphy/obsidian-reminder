import { t } from "i18n";
import { Setting } from "obsidian";
import { SettingModelBuilder } from "./setting-builders";
import { SettingRegistry } from "./setting-model";
import type { SettingModelBase } from "./setting-model";
import "./settings-tab.css";

export class SettingGroup {
  public settings: Array<SettingModelBase> = [];

  constructor(
    public name?: string,
    public collapsed: boolean = false,
  ) {}

  addSettings(...settingModels: Array<SettingModelBase>): void {
    this.settings.push(...settingModels);
  }
}

export class SettingPage {
  public groups: Array<SettingGroup> = [];

  constructor(public name: string) {}

  newGroup(name?: string, collapsed: boolean = false): SettingGroup {
    const group = new SettingGroup(name, collapsed);
    this.groups.push(group);
    return group;
  }
}

export class SettingTabModel {
  private pages: Array<SettingPage> = [];
  private registry: SettingRegistry = new SettingRegistry();
  // Session-only: which tab is shown. Intentionally not persisted to
  // data.json (resets to the first tab on every Obsidian restart).
  private activeTabIndex = 0;

  newSettingBuilder(): SettingModelBuilder {
    return new SettingModelBuilder(this.registry);
  }

  newPage(name: string): SettingPage {
    const page = new SettingPage(name);
    this.pages.push(page);
    return page;
  }

  displayOn(el: HTMLElement): void {
    el.empty();

    const tabBarEl = el.createDiv("reminder-settings-tab-bar");
    tabBarEl.setAttribute("role", "tablist");
    const tabButtons: Array<HTMLElement> = this.pages.map((page, index) => {
      const tabEl = tabBarEl.createEl("button", {
        cls: "reminder-settings-tab",
        text: t(page.name),
      });
      tabEl.setAttribute("role", "tab");
      tabEl.setAttribute("type", "button");
      tabEl.addEventListener("click", () => {
        this.activeTabIndex = index;
        this.updateTabButtons(tabButtons);
        this.renderActivePage(contentEl);
      });
      return tabEl;
    });
    this.updateTabButtons(tabButtons);

    const contentEl = el.createDiv("reminder-settings-tab-content");
    this.renderActivePage(contentEl);
  }

  private updateTabButtons(tabButtons: Array<HTMLElement>): void {
    tabButtons.forEach((tabEl, index) => {
      const active = index === this.activeTabIndex;
      tabEl.toggleClass("is-active", active);
      tabEl.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  private renderActivePage(contentEl: HTMLElement): void {
    contentEl.empty();
    const activePage = this.pages[this.activeTabIndex];
    if (activePage === undefined) {
      return;
    }
    activePage.groups.forEach((group) => {
      const groupEl = group.collapsed
        ? contentEl.createEl("details", {
            cls: "reminder-settings-collapsible-group",
          })
        : contentEl;
      if (group.collapsed && group.name !== undefined) {
        groupEl.createEl("summary", { text: t(group.name) });
      } else if (group.name !== undefined) {
        new Setting(contentEl).setName(t(group.name)).setHeading();
      }
      group.settings.forEach((setting) => {
        setting.createSetting(groupEl);
      });
    });
    this.registry.forEach((context) => context.update());
  }

  forEach(consumer: (setting: SettingModelBase) => void): void {
    this.pages.forEach((page) => {
      page.groups.forEach((group) => {
        group.settings.forEach((setting) => {
          if (setting === undefined) {
            console.error(
              "UNDEFINED SETTING in group:",
              group.name,
              "page:",
              page.name,
            );
            console.error("Group settings:", group.settings);
          }
          consumer(setting);
        });
      });
    });
  }
}
