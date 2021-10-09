import { ReadOnlyReference, Reference } from "model/ref";
import { Later, parseLaters, Time } from "model/time";
import { AbstractTextComponent, Setting } from "obsidian";
import { ReminderFormatType, ReminderFormatTypes } from "./format";

class SettingRegistry {
    private settingContexts: Array<SettingContext> = [];

    register(settingContext: SettingContext) {
        this.settingContexts.push(settingContext);
    }

    findByKey(key: string): SettingContext | undefined {
        return this.settingContexts.find(c => c.key === key);
    }

    forEach(consumer: (context: SettingContext) => void): void {
        this.settingContexts.forEach(consumer);
    }
}

class SettingContext {

    private validationEl?: HTMLElement;
    private infoEl?: HTMLElement;
    private _setting?: Setting;
    public key?: string;
    public name?: string;
    public desc?: string;
    public tags: Array<string> = [];
    public settingModel?: SettingModel<any, any>;
    anyValueChanged?: AnyValueChanged;

    constructor(private _settingRegistry: SettingRegistry) { }

    init(settingModel: SettingModel<any, any>, setting: Setting, containerEl: HTMLElement) {
        this.settingModel = settingModel;
        this._setting = setting;

        this.validationEl = containerEl.createDiv("validation", el => {
            el.style.color = 'var(--text-error)';
            el.style.marginBottom = '1rem';
            el.style.fontSize = '14px';
            el.style.display = 'none';
        });
        this.infoEl = containerEl.createDiv("info", el => {
            el.style.color = 'var(--text-faint)';
            el.style.marginBottom = '1rem';
            el.style.fontSize = '14px';
            el.style.display = 'none';
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
            el.style.display = "none";
        } else {
            el.style.display = "block";
            el.innerHTML = text;
        }
    }

    get setting() {
        return this._setting
    }

    get registry() {
        return this._settingRegistry;
    }

    hasTag(tag: string): boolean {
        return this.tags.filter(t => t === tag).length > 0;
    }

    update() {
        if (!this.anyValueChanged) {
            return;
        }
        this.anyValueChanged(this);
    }

    setEnabled(enable: boolean) {
        this.setting!.setDisabled(!enable);
    }

    findContextByKey(key: string) {
        return this._settingRegistry.findByKey(key);
    }

    booleanValue() {
        return this.settingModel!.value as boolean;
    }

    isInitialized() {
        return this.settingModel && this.validationEl && this.setting;
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

    name(name: string) {
        this.context.name = name;
        return this;
    }

    desc(desc: string) {
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

interface Serde<R, E> {
    unmarshal(rawValue: R): E
    marshal(value: E): R
}

type AnyValueChanged = (context: SettingContext) => void;

abstract class AbstractSettingModelBuilder<R> {

    constructor(protected context: SettingContext, protected initValue: R) { };

    onAnyValueChanged(anyValueChanged: AnyValueChanged) {
        this.context.anyValueChanged = anyValueChanged;
        return this;
    }

    abstract build<E>(serde: Serde<R, E>): SettingModel<R, E>;

    protected onValueChange() {
        this.context.registry.forEach(c => {
            c.update();
        });
    }

    protected buildSettingModel<E>(serde: Serde<R, E>, initializer: SettingInitilizer<R>) {
        return new SettingModelImpl(this.context, serde, this.initValue, initializer);
    }

}

class TextSettingModelBuilder extends AbstractSettingModelBuilder<string>{

    private _placeHolder?: string;

    constructor(context: SettingContext, private longText: boolean, initValue: string) {
        super(context, initValue);
    }

    placeHolder(placeHolder: string) {
        this._placeHolder = placeHolder;
        return this;
    }

    build<E>(serde: Serde<string, E>): SettingModel<string, E> {
        return this.buildSettingModel(serde, ({ setting, rawValue, context }) => {
            const initText = (text: AbstractTextComponent<any>) => {
                text
                    .setPlaceholder(this._placeHolder ?? "")
                    .setValue(rawValue.value)
                    .onChange(async (value) => {
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
                    })
            }
            if (this.longText) {
                setting.addTextArea((textarea) => {
                    initText(textarea);
                })
            } else {
                setting.addText((text) => {
                    initText(text);
                })
            }
        });
    }
}

class NumberSettingModelBuilder extends AbstractSettingModelBuilder<number>{

    private _placeHolder?: string;

    constructor(context: SettingContext, initValue: number) {
        super(context, initValue);
    }

    placeHolder(placeHolder: string) {
        this._placeHolder = placeHolder;
        return this;
    }

    build<E>(serde: Serde<number, E>): SettingModel<number, E> {
        return this.buildSettingModel(serde, ({ setting, rawValue, context }) => {
            const initText = (text: AbstractTextComponent<any>) => {
                text
                    .setPlaceholder(this._placeHolder ?? "")
                    .setValue(rawValue.value.toString())
                    .onChange(async (value) => {
                        try {
                            const n = parseInt(value);
                            rawValue.value = n;
                            context.setValidationError(null);
                            this.onValueChange();
                        } catch (e) {
                            if (e instanceof Error) {
                                context.setValidationError(e.message);
                            } else if (typeof e === "string") {
                                context.setValidationError(e);
                            }
                        }
                    })
            }
            setting.addText((textarea) => {
                initText(textarea);
            })
        });
    }
}

class ToggleSettingModelBuilder extends AbstractSettingModelBuilder<boolean>{

    build<E>(serde: Serde<boolean, E>): SettingModel<boolean, E> {
        return new SettingModelImpl(this.context, serde, this.initValue, ({ setting, rawValue }) => {
            setting.addToggle((toggle) =>
                toggle
                    .setValue(rawValue.value)
                    .onChange(async (value) => {
                        rawValue.value = value;
                        this.onValueChange();
                    })
            );
        })
    }

}

class DropdownOption {
    constructor(public label: string, public value: string) { }
}

class DropdownSettingModelBuilder<E> extends AbstractSettingModelBuilder<string>{

    private options: Array<DropdownOption> = [];

    addOption(label: string, value: string) {
        this.options.push(new DropdownOption(label, value));
        return this;
    }

    build<E>(serde: Serde<string, E>): SettingModel<string, E> {
        return new SettingModelImpl(this.context, serde, this.initValue, ({ setting, rawValue }) => {
            setting.addDropdown(d => {
                this.options.forEach(option => {
                    d.addOption(option.value, option.label);
                });
                d.setValue(rawValue.value);
                d.onChange(async (value) => {
                    rawValue.value = value;
                    this.onValueChange();
                });
            })
        })
    }

}

export interface SettingModel<R, E> extends ReadOnlyReference<E> {

    rawValue: Reference<R>;

    readonly key: string;

    createSetting(containerEl: HTMLElement): Setting;

    load(settings: any): void;

    store(settings: any): void;

    hasTag(tag: string): boolean;

}

type SettingInitilizer<R> = ({ setting, rawValue, context }: { setting: Setting, rawValue: Reference<R>, context: SettingContext }) => void;

class SettingModelImpl<R, E> implements SettingModel<R, E>{

    rawValue: Reference<R>;

    constructor(private context: SettingContext, private serde: Serde<R, E>, initRawValue: R, private settingInitializer: SettingInitilizer<R>) {
        this.rawValue = new Reference(initRawValue);
        if (context.key == null) {
            throw new Error("key is required.");
        }
    }

    createSetting(containerEl: HTMLElement): Setting {
        const setting = new Setting(containerEl)
            .setName(this.context.name ?? "")
            .setDesc(this.context.desc ?? "");
        this.context.init(this, setting, containerEl);
        this.settingInitializer({
            setting,
            rawValue: this.rawValue,
            context: this.context
        });
        return setting;
    }

    get value(): E {
        return this.serde.unmarshal(this.rawValue.value);
    }

    get key() {
        return this.context.key!;
    }

    load(settings: any): void {
        if (settings === undefined) {
            return;
        }
        const newValue = settings[this.key];
        if (newValue !== undefined) {
            this.rawValue.value = newValue;
        }
    }

    store(settings: any): void {
        settings[this.key] = this.rawValue.value;
    }

    hasTag(tag: string): boolean {
        return this.context.hasTag(tag);
    }
}

export class SettingGroup {
    public settings: Array<SettingModel<any, any>> = [];
    constructor(public name: string) {
    }

    addSettings(...settingModels: Array<SettingModel<any, any>>) {
        this.settings.push(...settingModels);
    }
}

export class SettingTabModel {

    private groups: Array<SettingGroup> = [];
    private registry: SettingRegistry = new SettingRegistry();

    newSettingBuilder(): SettingModelBuilder {
        return new SettingModelBuilder(this.registry);
    }

    newGroup(name: string): SettingGroup {
        const group = new SettingGroup(name);
        this.groups.push(group);
        return group;
    }

    displayOn(el: HTMLElement) {
        el.empty();
        this.groups.forEach(group => {
            el.createEl('h3', { text: group.name });
            group.settings.forEach(settings => {
                settings.createSetting(el);
            });
        });
        this.registry.forEach(context => context.update());
    }

    public forEach(consumer: (setting: SettingModel<any, any>) => void) {
        this.groups.forEach(group => {
            group.settings.forEach(setting => {
                consumer(setting);
            })
        })
    }
}

export class TimeSerde implements Serde<string, Time>{
    unmarshal(rawValue: string): Time {
        return Time.parse(rawValue);
    }
    marshal(value: Time): string {
        return value.toString();
    }
}

export class RawSerde<R> implements Serde<R, R>{
    unmarshal(rawValue: R): R {
        return rawValue;
    }
    marshal(value: R): R {
        return value;
    }
}

export class LatersSerde implements Serde<string, Array<Later>>{
    unmarshal(rawValue: string): Later[] {
        return parseLaters(rawValue);
    }
    marshal(value: Later[]): string {
        return value.map(v => v.label).join("\n");
    }
}

export class ReminderFormatTypeSerde implements Serde<string, ReminderFormatType>{

    unmarshal(rawValue: string): ReminderFormatType {
        const format = ReminderFormatTypes.find(format => format.name === rawValue)!;
        // TODO return undefined when it is not found
        return format;
    }
    marshal(value: ReminderFormatType): string {
        return value.name;
    }

}