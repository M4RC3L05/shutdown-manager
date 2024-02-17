import assert from "node:assert/strict";
import process from "node:process";
import { describe, it } from "node:test";
import timers from "node:timers/promises";
import { ShutdownManager } from "./mod.ts";

describe("ShutdownManager", () => {
  describe("constructor()", () => {
    it("should create a new shutdown manager and bind to the default signals", (t) => {
      const mock = t.mock.method(process, "on");

      const sm = new ShutdownManager();

      assert.strictEqual(mock.mock.calls.length, 7);
      assert.strictEqual(mock.mock.calls[0].arguments[0], "uncaughtException");
      assert.strictEqual(mock.mock.calls[1].arguments[0], "unhandledRejection");
      assert.strictEqual(mock.mock.calls[2].arguments[0], "SIGINT");
      assert.strictEqual(mock.mock.calls[3].arguments[0], "SIGTERM");
      assert.strictEqual(mock.mock.calls[4].arguments[0], "SIGABRT");
      assert.strictEqual(mock.mock.calls[5].arguments[0], "SIGUSR2");
      assert.strictEqual(mock.mock.calls[6].arguments[0], "exit");

      sm.disconnect();
    });

    it("should bind to the provided signals", (t) => {
      const mock = t.mock.method(process, "on");

      const sm = new ShutdownManager({ signals: ["SIGALRM"] });

      assert.strictEqual(mock.mock.calls.length, 4);
      assert.strictEqual(mock.mock.calls[0].arguments[0], "uncaughtException");
      assert.strictEqual(mock.mock.calls[1].arguments[0], "unhandledRejection");
      assert.strictEqual(mock.mock.calls[2].arguments[0], "SIGALRM");
      assert.strictEqual(mock.mock.calls[3].arguments[0], "exit");

      sm.disconnect();
    });
  });

  describe("addHook()", () => {
    it("should add a new hook", () => {
      const sm = new ShutdownManager();

      sm.addHook("foo", () => {});

      assert.strictEqual(sm.hooksSize, 1);

      sm.disconnect();
    });
  });

  describe("process signal", () => {
    it("should handle if no hook is added", async (t) => {
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [0]);
      assert.deepEqual(log.mock.callCount(), 2);
      assert.deepEqual(log.mock.calls[0].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);

      sm.disconnect();
    });

    it("should call the added hook", async (t) => {
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => Promise.resolve());

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [0]);
      assert.deepEqual(log.mock.callCount(), 5);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[2].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[3].arguments, ['Successful "foo" hook']);
      assert.deepEqual(log.mock.calls[4].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);

      sm.disconnect();
    });

    it("should call the added hooks", async (t) => {
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => Promise.resolve());
      sm.addHook("bar", () => Promise.resolve());

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [0]);
      assert.deepEqual(log.mock.callCount(), 8);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, ['Registered "bar" hook']);
      assert.deepEqual(log.mock.calls[2].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[3].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[4].arguments, ['Successful "foo" hook']);
      assert.deepEqual(log.mock.calls[5].arguments, ['Processing "bar" hook']);
      assert.deepEqual(log.mock.calls[6].arguments, ['Successful "bar" hook']);
      assert.deepEqual(log.mock.calls[7].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);

      sm.disconnect();
    });

    it("should call the added hook and log error and set the exit code as 1 if an error ocurred while processing the hook", async (t) => {
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => Promise.reject());

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 6);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[2].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[3].arguments, [
        { error: undefined },
        'Unsuccessful "foo" hook',
      ]);
      assert.deepEqual(log.mock.calls[4].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[5].arguments, [
        "Looks like some handlers where not able to be processed gracefully",
      ]);

      sm.disconnect();
    });

    it("should call the added hooks and log error and set the exit code as 1 if an error ocurred while processing the hook", async (t) => {
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => Promise.reject());
      sm.addHook("bar", () => Promise.resolve());

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 9);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, ['Registered "bar" hook']);
      assert.deepEqual(log.mock.calls[2].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[3].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[4].arguments, [
        { error: undefined },
        'Unsuccessful "foo" hook',
      ]);
      assert.deepEqual(log.mock.calls[5].arguments, ['Processing "bar" hook']);
      assert.deepEqual(log.mock.calls[6].arguments, ['Successful "bar" hook']);
      assert.deepEqual(log.mock.calls[7].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[8].arguments, [
        "Looks like some handlers where not able to be processed gracefully",
      ]);

      sm.disconnect();
    });

    it("should call the added hook and log warn and set the exit code as 1 if the hook timeouts runs out", async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => new Promise(() => {}));

      process.emit("SIGINT");
      t.mock.timers.tick(5001);

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 6);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[2].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[3].arguments, ['Timed out "foo" hook']);
      assert.deepEqual(log.mock.calls[4].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[5].arguments, [
        "Looks like some handlers where not able to be processed gracefully",
      ]);

      sm.disconnect();
    });

    it("should call the added hooks and log warn and set the exit code as 1 if the hook timeouts runs out", async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => new Promise(() => {}));
      sm.addHook("bar", () => Promise.resolve());

      process.emit("SIGINT");
      t.mock.timers.tick(5001);

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 9);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, ['Registered "bar" hook']);
      assert.deepEqual(log.mock.calls[2].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[3].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[4].arguments, ['Timed out "foo" hook']);
      assert.deepEqual(log.mock.calls[5].arguments, ['Processing "bar" hook']);
      assert.deepEqual(log.mock.calls[6].arguments, ['Successful "bar" hook']);
      assert.deepEqual(log.mock.calls[7].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[8].arguments, [
        "Looks like some handlers where not able to be processed gracefully",
      ]);

      sm.disconnect();
    });

    it("should call the added hook and log warn and force exit if the global hook timeouts runs out", async (t) => {
      const timeoutMock = t.mock.method(timers, "setTimeout");
      timeoutMock.mock.mockImplementation((_, val) =>
        val === "global-timeout" ? Promise.resolve(val) : new Promise(() => {}),
      );

      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => new Promise(() => {}));

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 5);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[2].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[3].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[4].arguments, [
        "Looks like the global timeout was reached",
      ]);

      sm.disconnect();
    });

    it("should call the added hooks and log warn and force exit if the global hook timeouts runs out", async (t) => {
      const timeoutMock = t.mock.method(timers, "setTimeout");
      timeoutMock.mock.mockImplementation((_, val) =>
        val === "global-timeout" ? Promise.resolve(val) : new Promise(() => {}),
      );

      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => new Promise(() => {}));

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 5);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[2].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[3].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[4].arguments, [
        "Looks like the global timeout was reached",
      ]);

      sm.disconnect();
    });

    it("should call the added hooks and log warn and force exit if the global hook timeouts runs out", async (t) => {
      const timeoutMock = t.mock.method(timers, "setTimeout");
      timeoutMock.mock.mockImplementation((_, val) =>
        val === "global-timeout" ? Promise.resolve(val) : new Promise(() => {}),
      );

      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => Promise.resolve());
      sm.addHook("bar", () => new Promise(() => {}));

      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [1]);
      assert.deepEqual(log.mock.callCount(), 8);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, ['Registered "bar" hook']);
      assert.deepEqual(log.mock.calls[2].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[3].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[4].arguments, ['Successful "foo" hook']);
      assert.deepEqual(log.mock.calls[5].arguments, ['Processing "bar" hook']);
      assert.deepEqual(log.mock.calls[6].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);
      assert.deepEqual(log.mock.calls[7].arguments, [
        "Looks like the global timeout was reached",
      ]);

      sm.disconnect();
    });

    it("should ignore if it was already processing a signal", async (t) => {
      let waitResolveP: (value: unknown) => void;
      const waitP = new Promise((resolve) => {
        waitResolveP = resolve;
      });

      const exitMock = t.mock.method(process, "exit");
      exitMock.mock.mockImplementation(() => {
        waitResolveP(undefined);
      });

      const log = t.mock.fn();

      const sm = new ShutdownManager({
        log: { info: log, error: log, warn: log },
      });

      sm.addHook("foo", () => Promise.resolve());

      process.emit("SIGINT");
      process.emit("SIGINT");

      await waitP;

      assert.deepEqual(exitMock.mock.callCount(), 1);
      assert.deepEqual(exitMock.mock.calls[0].arguments, [0]);
      assert.deepEqual(log.mock.callCount(), 6);
      assert.deepEqual(log.mock.calls[0].arguments, ['Registered "foo" hook']);
      assert.deepEqual(log.mock.calls[1].arguments, [
        { signal: "SIGINT" },
        "Processing exit signal",
      ]);
      assert.deepEqual(log.mock.calls[2].arguments, ['Processing "foo" hook']);
      assert.deepEqual(log.mock.calls[3].arguments, [
        { signal: "SIGINT" },
        "Ignoring process exit signal has the app is shutting down.",
      ]);
      assert.deepEqual(log.mock.calls[4].arguments, ['Successful "foo" hook']);
      assert.deepEqual(log.mock.calls[5].arguments, [
        { signal: "SIGINT" },
        "Exit signal process completed",
      ]);

      sm.disconnect();
    });
  });
});
