import process from "node:process";
import timers from "node:timers/promises";

export type ShutdownHookHandler = () => Promise<void> | void;

export type ShutdownHook = {
  name: string;
  handler: ShutdownHookHandler;
};

export type Logger = {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  warn: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  error: (...args: any[]) => any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  info: (...args: any[]) => any;
};

export type ShutdownManagerArgs = {
  signals?: NodeJS.Signals[];
  log?: Logger;

  /**
   * in milliseconds
   */
  perHookTimeout?: number;

  /**
   * in milliseconds
   */
  shutdownTimeout?: number;
};

export class ShutdownManager {
  #handlers: ShutdownHook[] = [];
  #signals: NodeJS.Signals[];
  #shuttingDown = false;
  #abortController = new AbortController();
  #log?: Logger;
  #perHookTimeout: number;
  #shutdownTimeout: number;

  constructor(options?: ShutdownManagerArgs) {
    this.#signals = options?.signals ?? [
      "SIGINT",
      "SIGTERM",
      "SIGABRT",
      "SIGUSR2",
    ];
    this.#log = options?.log;
    this.#perHookTimeout = options?.perHookTimeout ?? 5000;
    this.#shutdownTimeout = options?.shutdownTimeout ?? 10_000;

    this.#bind(true);
  }

  get abortSignal() {
    return this.#abortController.signal;
  }

  get hooksSize() {
    return this.#handlers.length;
  }

  addHook(name: string, handler: ShutdownHookHandler) {
    this.#log?.info(`Registered "${name}" hook`);

    this.#handlers.push({ handler, name });
  }

  disconnect() {
    this.#bind(false);
  }

  #bind(on?: boolean) {
    process[on ? "on" : "off"]("uncaughtException", this.#processErrors);
    process[on ? "on" : "off"]("unhandledRejection", this.#processErrors);

    for (const signal of this.#signals) {
      if (on) {
        process.on(signal, this.#processSignal.bind(this, signal));
      } else {
        process.removeAllListeners(signal);
      }
    }

    process[on ? "on" : "off"]("exit", this.#onExit);
  }

  #onExit = (code: number) => {
    this.#log?.info(`Exiting with status code of ${code}`);
  };

  #processErrors = (error: unknown) => {
    this.#log?.error(
      typeof error === "object" ? error : { error },
      "Uncaught/Unhandled",
    );

    this.#processSignal("SIGUSR2");
  };

  #processSignal = async (signal: NodeJS.Signals) => {
    if (this.#shuttingDown) {
      this.#log?.warn(
        { signal },
        "Ignoring process exit signal has the app is shutting down.",
      );

      return;
    }

    this.#log?.info({ signal }, "Processing exit signal");

    this.#shuttingDown = true;
    let withError = false;
    let forceExit = false;

    this.#abortController.abort();

    const globalTimeout = timers.setTimeout(
      this.#shutdownTimeout,
      "global-timeout",
      { ref: false },
    );

    for (const { name, handler } of this.#handlers) {
      this.#log?.info(`Processing "${name}" hook`);

      try {
        const response = await Promise.race([
          handler(),
          timers.setTimeout(this.#perHookTimeout, "timeout", { ref: false }),
          globalTimeout,
        ]);

        if (response === "timeout") {
          withError = true;
          this.#log?.info(`Timed out "${name}" hook`);
        } else if (response === "global-timeout") {
          forceExit = true;
        } else {
          this.#log?.info(`Successful "${name}" hook`);
        }
      } catch (error: unknown) {
        this.#log?.error(
          error instanceof Error ? error : { error },
          `Unsuccessful "${name}" hook`,
        );

        withError = true;
      }
    }

    this.#log?.info({ signal }, "Exit signal process completed");

    if (withError) {
      this.#log?.warn(
        "Looks like some handlers where not able to be processed gracefully",
      );
    }

    if (forceExit) {
      this.#log?.warn("Looks like the global timeout was reached");
    }

    process.exit(withError || forceExit ? 1 : 0);
  };
}

export default ShutdownManager;
