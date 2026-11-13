import { t } from "i18n";
import { Reference } from "model/ref";
import type { ReadOnlyReference } from "model/ref";
import { Setting } from "obsidian";
import type { Serde } from "./serdes";

/**
 * Text a setting displays: either English source text -- translated when the
 * setting is rendered, so the settings tab follows a language change without
 * rebuilding the models -- or a function that produces already-translated text
 * (for text assembled from other translated pieces, e.g. a format's name).
 */
export type TranslatableText = string | (() => string);

/** Resolves a `TranslatableText` to the text to display right now. */
export function resolveText(text: TranslatableText | undefined): string {
  if (text === undefined) {
    return "";
  }
  return t(typeof text === "function" ? text() : text);
}

export class SettingRegistry {
  private settingContexts: Array<SettingContext> = [];

  register(settingContext: SettingContext) {
    this.settingContexts.push(settingContext);
  }

  findByKey(key: string): SettingContext | undefined {
    return this.settingContexts.find((c) => c.key === key);
  }

  forEach(consumer: (context: SettingContext) => void): void {
    this.settingContexts.forEach(consumer);
  }
}

export class SettingContext {
  private validationEl?: HTMLElement;
  private infoEl?: HTMLElement;
  private _setting?: Setting;
  public key?: string;
  public name?: TranslatableText;
  public desc?: TranslatableText;
  public tags: Array<string> = [];
  public settingModel?: SettingModelBase;
  public buttons: Array<SettingButton> = [];
  anyValueChanged?: AnyValueChanged;

  constructor(private _settingRegistry: SettingRegistry) {}

  init(settingModel: SettingModelBase, setting: Setting) {
    this.settingModel = settingModel;
    this._setting = setting;

    // Appended to the setting's description element so validation/info lines
    // render inside the setting item, under the description text.
    this.validationEl = setting.descEl.createDiv(
      "reminder-setting-validation",
      (el) => {
        el.hidden = true;
      },
    );
    this.infoEl = setting.descEl.createDiv("reminder-setting-info", (el) => {
      el.hidden = true;
    });
  }

  setValidationError(error: string | null) {
    this.setText(this.validationEl!, error);
  }

  setInfo(info: string | null) {
    this.setText(this.infoEl!, info);
  }

  private setText(el: HTMLElement, text: string | null) {
    if (!el) {
      console.error("element not created");
      return;
    }
    if (text === null) {
      el.hidden = true;
    } else {
      el.hidden = false;
      el.textContent = text;
    }
  }

  get setting() {
    return this._setting;
  }

  get registry() {
    return this._settingRegistry;
  }

  hasTag(tag: string): boolean {
    return this.tags.filter((t) => t === tag).length > 0;
  }

  update() {
    if (!this.isInitialized()) {
      return;
    }
    if (!this.anyValueChanged) {
      return;
    }
    this.anyValueChanged(this);
  }

  setEnabled(enable: boolean) {
    this.setting!.setDisabled(!enable);
    this.setting!.settingEl.toggleClass("reminder-setting-disabled", !enable);
  }

  findContextByKey(key: string) {
    return this._settingRegistry.findByKey(key);
  }

  booleanValue() {
    // `settingModel` is type-erased to `SettingModelBase` here, but
    // `booleanValue()` is only ever called for toggle (boolean) settings,
    // so casting back to a concrete `SettingModel` to read `value` is safe.
    return (this.settingModel! as SettingModel<unknown, unknown>)
      .value as boolean;
  }

  isInitialized() {
    return this.settingModel && this.validationEl && this.setting;
  }
}

export interface SettingModelBase {
  readonly key: string;

  createSetting(containerEl: HTMLElement): Setting;

  load(settings: Record<string, unknown> | undefined): void;

  store(settings: Record<string, unknown>): void;

  hasTag(tag: string): boolean;
}

export interface SettingButton {
  label: TranslatableText;
  onClick: (context: SettingContext) => void | Promise<void>;
}

export type AnyValueChanged = (context: SettingContext) => void;

export type SettingInitializer<R> = ({
  setting,
  rawValue,
  context,
  setDisplayValue,
}: {
  setting: Setting;
  rawValue: Reference<R>;
  context: SettingContext;
  setDisplayValue: (update: (value: R) => void) => void;
}) => void;

export interface SettingModel<R, E>
  extends SettingModelBase, ReadOnlyReference<E> {
  rawValue: Reference<R>;
}

export class SettingModelImpl<R, E> implements SettingModel<R, E> {
  rawValue: Reference<R>;
  private updateDisplay?: (value: R) => void;

  constructor(
    private context: SettingContext,
    private serde: Serde<R, E>,
    initRawValue: R,
    private settingInitializer: SettingInitializer<R>,
  ) {
    this.rawValue = new Reference(initRawValue);
    this.rawValue.onChanged((_oldValue, value) => {
      this.updateDisplay?.(value);
    });
    if (context.key == null) {
      throw new Error("key is required.");
    }
  }

  createSetting(containerEl: HTMLElement): Setting {
    const setting = new Setting(containerEl)
      .setName(resolveText(this.context.name))
      .setDesc(resolveText(this.context.desc));
    this.context.init(this, setting);
    this.settingInitializer({
      setting,
      rawValue: this.rawValue,
      context: this.context,
      setDisplayValue: (update) => {
        this.updateDisplay = update;
      },
    });
    // After the initializer, so the button lands to the right of the
    // setting's own input rather than in front of it.
    this.context.buttons.forEach((button) => {
      setting.addButton((b) => {
        b.setButtonText(resolveText(button.label)).onClick(async () => {
          // A button's handler is typically a network round-trip; disabling
          // it for the duration keeps a second click from starting an
          // overlapping run whose result would race the first one's.
          b.setDisabled(true);
          try {
            await button.onClick(this.context);
          } finally {
            b.setDisabled(false);
          }
        });
      });
    });
    return setting;
  }

  get value(): E {
    return this.serde.unmarshal(this.rawValue.value);
  }

  get key() {
    return this.context.key!;
  }

  load(settings: Record<string, unknown> | undefined): void {
    if (settings === undefined) {
      return;
    }
    const newValue = settings[this.key];
    if (newValue !== undefined) {
      // Persisted values are trusted to already match the shape they were
      // stored in by `store()`, so this cast back to `R` is safe.
      this.rawValue.value = newValue as R;
    }
  }

  store(settings: Record<string, unknown>): void {
    settings[this.key] = this.rawValue.value;
  }

  hasTag(tag: string): boolean {
    return this.context.hasTag(tag);
  }
}
