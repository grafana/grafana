// Type definitions for mocha 2.2.5
// Project: http://mochajs.org/
// Definitions by: Kazi Manzur Rashid <https://github.com/kazimanzurrashid/>, otiai10 <https://github.com/otiai10>, jt000 <https://github.com/jt000>, Vadim Macagon <https://github.com/enlight>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

interface MochaSetupOptions {
    //milliseconds to wait before considering a test slow
    slow?: number;

    // timeout in milliseconds
    timeout?: number;

    // ui name "bdd", "tdd", "exports" etc
    ui?: string;

    //array of accepted globals
    globals?: any[];

    // reporter instance (function or string), defaults to `mocha.reporters.Spec`
    reporter?: any;

    // bail on the first test failure
    bail?: boolean;

    // ignore global leaks
    ignoreLeaks?: boolean;

    // grep string or regexp to filter tests with
    grep?: any;
}

interface MochaDone {
    (error?: Error): void;
}

declare var mocha: Mocha;
declare var describe: Mocha.IContextDefinition;
declare var xdescribe: Mocha.IContextDefinition;
// alias for `describe`
declare var context: Mocha.IContextDefinition;
// alias for `describe`
declare var suite: Mocha.IContextDefinition;
declare var it: Mocha.ITestDefinition;
declare var xit: Mocha.ITestDefinition;
// alias for `it`
declare var test: Mocha.ITestDefinition;

declare function before(action: () => void): void;

declare function before(action: (done: MochaDone) => void): void;

declare function setup(action: () => void): void;

declare function setup(action: (done: MochaDone) => void): void;

declare function after(action: () => void): void;

declare function after(action: (done: MochaDone) => void): void;

declare function teardown(action: () => void): void;

declare function teardown(action: (done: MochaDone) => void): void;

declare function beforeEach(action: () => void): void;

declare function beforeEach(action: (done: MochaDone) => void): void;

declare function suiteSetup(action: () => void): void;

declare function suiteSetup(action: (done: MochaDone) => void): void;

declare function afterEach(action: () => void): void;

declare function afterEach(action: (done: MochaDone) => void): void;

declare function suiteTeardown(action: () => void): void;

declare function suiteTeardown(action: (done: MochaDone) => void): void;

declare class Mocha {
    constructor(options?: {
        grep?: RegExp;
        ui?: string;
        reporter?: string;
        timeout?: number;
        bail?: boolean;
    });

    /** Setup mocha with the given options. */
    setup(options: MochaSetupOptions): Mocha;
    bail(value?: boolean): Mocha;
    addFile(file: string): Mocha;
    /** Sets reporter by name, defaults to "spec". */
    reporter(name: string): Mocha;
    /** Sets reporter constructor, defaults to mocha.reporters.Spec. */
    reporter(reporter: (runner: Mocha.IRunner, options: any) => any): Mocha;
    ui(value: string): Mocha;
    grep(value: string): Mocha;
    grep(value: RegExp): Mocha;
    invert(): Mocha;
    ignoreLeaks(value: boolean): Mocha;
    checkLeaks(): Mocha;
    /** Enables growl support. */
    growl(): Mocha;
    globals(value: string): Mocha;
    globals(values: string[]): Mocha;
    useColors(value: boolean): Mocha;
    useInlineDiffs(value: boolean): Mocha;
    timeout(value: number): Mocha;
    slow(value: number): Mocha;
    enableTimeouts(value: boolean): Mocha;
    asyncOnly(value: boolean): Mocha;
    noHighlighting(value: boolean): Mocha;
    /** Runs tests and invokes `onComplete()` when finished. */
    run(onComplete?: (failures: number) => void): Mocha.IRunner;
}

// merge the Mocha class declaration with a module
declare module Mocha {
    /** Partial interface for Mocha's `Runnable` class. */
    interface IRunnable {
        title: string;
        fn: Function;
        async: boolean;
        sync: boolean;
        timedOut: boolean;
    }

    /** Partial interface for Mocha's `Suite` class. */
    interface ISuite {
        parent: ISuite;
        title: string;

        fullTitle(): string;
    }

    /** Partial interface for Mocha's `Test` class. */
    interface ITest extends IRunnable {
        parent: ISuite;
        pending: boolean;

        fullTitle(): string;
    }

    /** Partial interface for Mocha's `Runner` class. */
    interface IRunner {}

    interface IContextDefinition {
        (description: string, spec: () => void): ISuite;
        only(description: string, spec: () => void): ISuite;
        skip(description: string, spec: () => void): void;
        timeout(ms: number): void;
    }

    interface ITestDefinition {
        (expectation: string, assertion?: () => void): ITest;
        (expectation: string, assertion?: (done: MochaDone) => void): ITest;
        only(expectation: string, assertion?: () => void): ITest;
        only(expectation: string, assertion?: (done: MochaDone) => void): ITest;
        skip(expectation: string, assertion?: () => void): void;
        skip(expectation: string, assertion?: (done: MochaDone) => void): void;
        timeout(ms: number): void;
    }

    export module reporters {
        export class Base {
            stats: {
                suites: number;
                tests: number;
                passes: number;
                pending: number;
                failures: number;
            };

            constructor(runner: IRunner);
        }

        export class Doc extends Base {}
        export class Dot extends Base {}
        export class HTML extends Base {}
        export class HTMLCov extends Base {}
        export class JSON extends Base {}
        export class JSONCov extends Base {}
        export class JSONStream extends Base {}
        export class Landing extends Base {}
        export class List extends Base {}
        export class Markdown extends Base {}
        export class Min extends Base {}
        export class Nyan extends Base {}
        export class Progress extends Base {
            /**
             * @param options.open String used to indicate the start of the progress bar.
             * @param options.complete String used to indicate a complete test on the progress bar.
             * @param options.incomplete String used to indicate an incomplete test on the progress bar.
             * @param options.close String used to indicate the end of the progress bar.
             */
            constructor(runner: IRunner, options?: {
                open?: string;
                complete?: string;
                incomplete?: string;
                close?: string;
            });
        }
        export class Spec extends Base {}
        export class TAP extends Base {}
        export class XUnit extends Base {
            constructor(runner: IRunner, options?: any);
        }
    }
}

declare module "mocha" {
    export = Mocha;
}
