type OnChangeFunction = <T>(oldValue: T, newValue: T) => void;

export class ReadOnlyReference<T> {
  constructor(protected _value: T) {}

  public get value() {
    return this._value;
  }

  public toString(): string {
    return `Ref<${this._value}>`;
  }
}

export class Reference<T> extends ReadOnlyReference<T> {
  private onChangeFunctions: Array<OnChangeFunction> = [];
  constructor(protected _value: T) {
    super(_value);
  }

  public onChanged(listener: OnChangeFunction) {
    this.onChangeFunctions.push(listener);
  }

  public get value() {
    return this._value;
  }

  public set value(value: T) {
    const oldValue = this._value;
    this._value = value;
    this.onChangeFunctions.forEach((f) => {
      f(oldValue, value);
    });
  }
}
