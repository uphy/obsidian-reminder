type OnChangeFunction = <T>(oldValue: T, newValue: T) => void;

export interface ReadOnlyReference<T> {

  get value(): T;

}

export class ConstantReference<T> implements ReadOnlyReference<T>{

  constructor(private _value: T) { }

  get value(): T {
    return this._value;
  }

}

export class Reference<T> implements ReadOnlyReference<T> {
  private onChangeFunctions: Array<OnChangeFunction> = [];
  constructor(private _value: T) { }

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
