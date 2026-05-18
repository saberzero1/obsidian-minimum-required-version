declare global {
  interface Array<T> {
    /** @since 1.0.0 */
    customMethod(): void;
  }
}

/** @since 0.9.0 */
export class SampleApp {
  /** @since 0.9.0 */
  vault: SampleVault;
  /** @since 1.2.0 */
  doSomething(): void;
  /** @since 0.9.0 */
  static create(): SampleApp;
}

/** @since 0.9.0 */
export class SampleVault {
  /** @since 0.9.0 */
  on(name: "create", callback: () => void): void;
  /** @since 1.1.0 */
  on(name: "delete", callback: () => void): void;
  /** @since 1.3.0 */
  on(name: "rename", callback: () => void): void;
}

/** @since 1.0.0 */
export interface SampleConfig {
  name: string;
}

/** @since 1.1.0 */
export type SampleResult = string | number;

/** @since 0.9.0 */
export function sampleHelper(input: string): string;

/** @since 1.0.0 */
export let sampleVersion: string;

export function noSinceFunction(): void;

/** @since 1.2.0 */
export abstract class SampleAbstract {
  /** @since 1.2.0 */
  abstract render(): void;
}
