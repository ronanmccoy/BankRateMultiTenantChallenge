const REDACTED = '[redacted]';

/**
 * A value that is sensitive to the tenant's privacy policy. It can be revealed in the engine, but it is never serialized or logged.
 * The engine never sees the raw value, only the `Redacted` wrapper. The engine can reveal it to evaluate rules, but it is never logged or serialized.
 */
export class Redacted<T> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  reveal(): T {
    return this.#value;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }
}
