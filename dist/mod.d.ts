/// <reference types="node" resolution-mode="require"/>
export type ShutdownHookHandler = () => Promise<void> | void;
export type ShutdownHook = {
    name: string;
    handler: ShutdownHookHandler;
};
export type Logger = {
    warn: (...args: any[]) => any;
    error: (...args: any[]) => any;
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
export declare class ShutdownManager {
    #private;
    constructor(options?: ShutdownManagerArgs);
    get abortSignal(): AbortSignal;
    get hooksSize(): number;
    addHook(name: string, handler: ShutdownHookHandler): void;
    disconnect(): void;
}
export default ShutdownManager;
