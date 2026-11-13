import { t } from "i18n";
import { AbstractTextComponent } from "obsidian";
import type { Serde } from "./serdes";
import {
  type AnyValueChanged,
  SettingContext,
  type SettingInitializer,
  type SettingModel,
  SettingModelImpl,
  type SettingRegistry,
  type TranslatableText,
  resolveText,
} from "./setting-model";

/**
 * Text a setting displays: either English source text -- translated when the
 * setting is rendered, so the settings tab follows a language change without
 * rebuilding the models -- or a function that produces already-translated text
 * (for text assembled from other translated pieces, e.g. a format's name).
 */
/**
 * An action button rendered alongside a setting's own input component (see
 * `AbstractSettingModelBuilder.button()`). The handler receives the same
 * `SettingContext` as `onAnyValueChanged`, so it can report what it did
 * through the setting's existing info/validation lines.
 */
export interface SettingButton {
  label: TranslatableText;
  onClick: (context: SettingContext) => void | Promise<void>;
}

abstract class AbstractSettingModelBuilder<R> {
  constructor(
    protected context: SettingContext,
    protected initValue: R,
  ) {}

  onAnyValueChanged(anyValueChanged: AnyValueChanged) {
    this.context.anyValueChanged = anyValueChanged;
    return this;
  }

  /**
   * Adds an action button next to this setting's input component. The button
   * belongs to the setting rather than being a row of its own, so every entry
   * in a `SettingGroup` stays a real `SettingModel` with a value — which is
   * what `PluginData`'s constructor assumes when it registers a change
   * listener on each setting's `rawValue`.
   */
  button(
    label: TranslatableText,
    onClick: (context: SettingContext) => void | Promise<void>,
  ) {
    this.context.buttons.push({ label, onClick });
    return this;
  }

  abstract build<E>(serde: Serde<R, E>): SettingModel<R, E>;

  protected onValueChange() {
    this.context.registry.forEach((c) => {
      c.update();
    });
  }

  protected buildSettingModel<E>(
    serde: Serde<R, E>,
    initializer: SettingInitializer<R>,
  ) {
    return new SettingModelImpl(
      this.context,
      serde,
      this.initValue,
      initializer,
    );
  }

  /**
   * Wires the shared placeholder/value/onChange behavior for a text-like
   * component (`TextComponent` or `TextAreaComponent`). Callers supply only
   * their own parse/validate logic via `onChange`.
   */
  protected wireTextComponent(
    text: AbstractTextComponent<HTMLInputElement | HTMLTextAreaElement>,
    placeHolder: string,
    initialValue: string,
    setDisplayValue: (update: (value: string) => void) => void,
    onChange: (value: string) => void,
  ): void {
    text
      .setPlaceholder(placeHolder)
      .setValue(initialValue)
      .onChange(async (value) => {
        onChange(value);
      });
    setDisplayValue((value) => {
      if (text.getValue() !== value) {
        text.setValue(value);
      }
    });
  }
}

export class TextSettingModelBuilder extends AbstractSettingModelBuilder<string> {
  private _placeHolder?: TranslatableText;
  private _masked = false;

  constructor(
    context: SettingContext,
    private longText: boolean,
    initValue: string,
  ) {
    super(context, initValue);
  }

  placeHolder(placeHolder: TranslatableText) {
    this._placeHolder = placeHolder;
    return this;
  }

  /**
   * Renders the input as a password field, so a secret isn't left readable on
   * screen while the settings tab is open (screen sharing, screenshots,
   * anyone standing behind you). It's display only: the value is still stored
   * in `data.json` in plain text like every other setting.
   *
   * Ignored for `textArea()` settings — a `<textarea>` has no masked mode.
   */
  masked() {
    this._masked = true;
    return this;
  }

  build<E>(serde: Serde<string, E>): SettingModel<string, E> {
    return this.buildSettingModel(
      serde,
      ({ setting, rawValue, context, setDisplayValue }) => {
        const initText = (
          text: AbstractTextComponent<HTMLInputElement | HTMLTextAreaElement>,
        ) => {
          this.wireTextComponent(
            text,
            resolveText(this._placeHolder),
            rawValue.value,
            setDisplayValue,
            (value) => {
              try {
                serde.unmarshal(value);
                rawValue.value = value;
                context.setValidationError(null);
                this.onValueChange();
              } catch (e) {
                if (e instanceof Error) {
                  context.setValidationError(e.message);
                } else if (typeof e === "string") {
                  context.setValidationError(e);
                }
              }
            },
          );
        };
        if (this.longText) {
          setting.addTextArea((textarea) => {
            initText(textarea);
          });
        } else {
          setting.addText((text) => {
            initText(text);
            if (this._masked) {
              text.inputEl.type = "password";
            }
          });
        }
      },
    );
  }
}

export class NumberSettingModelBuilder extends AbstractSettingModelBuilder<number> {
  private _placeHolder?: TranslatableText;

  constructor(context: SettingContext, initValue: number) {
    super(context, initValue);
  }

  placeHolder(placeHolder: TranslatableText) {
    this._placeHolder = placeHolder;
    return this;
  }

  build<E>(serde: Serde<number, E>): SettingModel<number, E> {
    return this.buildSettingModel(
      serde,
      ({ setting, rawValue, context, setDisplayValue }) => {
        setting.addText((text) => {
          this.wireTextComponent(
            text,
            resolveText(this._placeHolder),
            rawValue.value.toString(),
            (update) => {
              setDisplayValue((value) => {
                update(value.toString());
              });
            },
            (value) => {
              const n = parseInt(value, 10);
              if (Number.isNaN(n)) {
                context.setValidationError(t("Please enter a valid number."));
                return;
              }
              context.setValidationError(null);
              rawValue.value = n;
              this.onValueChange();
            },
          );
        });
      },
    );
  }
}

export class ToggleSettingModelBuilder extends AbstractSettingModelBuilder<boolean> {
  build<E>(serde: Serde<boolean, E>): SettingModel<boolean, E> {
    return new SettingModelImpl(
      this.context,
      serde,
      this.initValue,
      ({ setting, rawValue }) => {
        setting.addToggle((toggle) =>
          toggle.setValue(rawValue.value).onChange(async (value) => {
            rawValue.value = value;
            this.onValueChange();
          }),
        );
      },
    );
  }
}

export class DropdownOption {
  constructor(
    public label: TranslatableText,
    public value: string,
  ) {}
}

export class DropdownSettingModelBuilder extends AbstractSettingModelBuilder<string> {
  private options: Array<DropdownOption> = [];

  addOption(label: TranslatableText, value: string) {
    this.options.push(new DropdownOption(label, value));
    return this;
  }

  build<E>(serde: Serde<string, E>): SettingModel<string, E> {
    return new SettingModelImpl(
      this.context,
      serde,
      this.initValue,
      ({ setting, rawValue, setDisplayValue }) => {
        setting.addDropdown((d) => {
          this.options.forEach((option) => {
            d.addOption(option.value, resolveText(option.label));
          });
          d.setValue(rawValue.value);
          setDisplayValue((value) => {
            d.setValue(value);
          });
          d.onChange(async (value) => {
            rawValue.value = value;
            this.onValueChange();
          });
        });
      },
    );
  }
}

export class SettingModelBuilder {
  context: SettingContext;

  constructor(public registry: SettingRegistry) {
    this.context = new SettingContext(this.registry);
    this.registry.register(this.context);
  }

  key(key: string) {
    this.context.key = key;
    return this;
  }

  name(name: TranslatableText) {
    this.context.name = name;
    return this;
  }

  desc(desc: TranslatableText) {
    this.context.desc = desc;
    return this;
  }

  tag(tag: string) {
    this.context.tags.push(tag);
    return this;
  }

  enableWhen(enableWhen: AnyValueChanged) {
    this.context.anyValueChanged = enableWhen;
    return this;
  }

  text(initValue: string) {
    return new TextSettingModelBuilder(this.context, false, initValue);
  }

  textArea(initValue: string) {
    return new TextSettingModelBuilder(this.context, true, initValue);
  }

  number(initValue: number) {
    return new NumberSettingModelBuilder(this.context, initValue);
  }

  toggle(initValue: boolean) {
    return new ToggleSettingModelBuilder(this.context, initValue);
  }

  dropdown(initValue: string) {
    return new DropdownSettingModelBuilder(this.context, initValue);
  }
}
