const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { runInContext } = require('node:vm');
const Environment = require('../../../public/test/happy-dom-environment');

function createEnvironment() {
  return new Environment(
    { projectConfig: { globals: {}, testEnvironmentOptions: {}, fakeTimers: {}, id: 'domexception', rootDir: path.resolve(__dirname, '../../../public/test') } },
    { console, testPath: __filename, docblockPragmas: {} }
  );
}

test('DOMException preserves native branding, realm inheritance, conversion and subclassing', async () => {
  const environment = createEnvironment();
  try {
    const results = runInContext(`(() => {
      const error = new DOMException('cancelled', 'AbortError');
      class CustomException extends DOMException {}
      const custom = new CustomException('custom', 'DataCloneError');
      const invalidReceiver = () => Object.getOwnPropertyDescriptor(DOMException.prototype, 'name').get.call({});
      const throwsTypeError = fn => { try { fn(); return false; } catch (e) { return e instanceof TypeError; } };
      return [error instanceof Error, error instanceof DOMException,
        error.name, error.message, error.code, error.toString(), Object.prototype.toString.call(error),
        new DOMException().name, new DOMException().message, new DOMException().code,
        new DOMException(123, 456).toString(), custom instanceof CustomException,
        custom instanceof DOMException, custom instanceof Error, custom.code,
        DOMException.ABORT_ERR, DOMException.prototype.ABORT_ERR,
        throwsTypeError(invalidReceiver), throwsTypeError(() => new DOMException(Symbol())),
        throwsTypeError(() => new DOMException('', Symbol())), throwsTypeError(() => DOMException())];
    })()`, environment.getVmContext());
    assert.deepEqual(Array.from(results), [true, true, 'AbortError', 'cancelled', 20, 'AbortError: cancelled',
      '[object DOMException]', 'Error', '', 0, '456: 123', true, true, true, 25, 20, 20, true, true, true, true]);
    for (const [name, value] of Object.entries(globalThis.DOMException)) {
      if (typeof value === 'number') assert.equal(environment.global.DOMException[name], value);
    }
  } finally {
    await environment.teardown();
  }
});

test('exception construction and abort leave stacks lazy and retain abort reason identity', async () => {
  const environment = createEnvironment();
  const hostDescriptor = Object.getOwnPropertyDescriptor(Error, 'prepareStackTrace');
  const realmError = environment.global.Error;
  const realmDescriptor = Object.getOwnPropertyDescriptor(realmError, 'prepareStackTrace');
  let formats = 0;
  try {
    Error.prepareStackTrace = realmError.prepareStackTrace = () => { formats++; return 'formatted stack'; };
    const { DOMException, AbortController } = environment.global;
    const error = new DOMException('failure', 'DataCloneError');
    const controller = new AbortController();
    let events = 0;
    controller.signal.addEventListener('abort', () => events++);
    controller.abort();
    const reason = controller.signal.reason;
    assert.equal(formats, 0);
    assert.ok(reason instanceof DOMException);
    assert.ok(reason instanceof realmError);
    assert.equal(reason.name, 'AbortError');
    assert.equal(reason.code, 20);
    assert.equal(events, 1);
    controller.abort('ignored');
    assert.equal(controller.signal.reason, reason);
    assert.equal(events, 1);
    assert.throws(() => controller.signal.throwIfAborted(), caught => caught === reason);
    assert.equal(error.stack, 'formatted stack');
    assert.equal(formats, 1);
    assert.equal(error.stack, 'formatted stack');
    assert.equal(formats, 1);
    const custom = new AbortController();
    const customReason = { custom: true };
    custom.abort(customReason);
    assert.equal(custom.signal.reason, customReason);
    assert.throws(() => custom.signal.throwIfAborted(), caught => caught === customReason);
  } finally {
    if (hostDescriptor) Object.defineProperty(Error, 'prepareStackTrace', hostDescriptor);
    else delete Error.prepareStackTrace;
    if (realmDescriptor) Object.defineProperty(realmError, 'prepareStackTrace', realmDescriptor);
    else delete realmError.prepareStackTrace;
    await environment.teardown();
  }
});

test('DOMException constructors and prototypes are isolated between environments', async () => {
  const first = createEnvironment();
  const constructor = first.global.DOMException;
  constructor.prototype.extra = true;
  await first.teardown();
  const second = createEnvironment();
  try {
    assert.notEqual(second.global.DOMException, constructor);
    assert.equal(second.global.DOMException.prototype.extra, undefined);
    assert.ok(new second.global.DOMException() instanceof second.global.Error);
  } finally {
    await second.teardown();
  }
});

test('core-js retains the lazy constructor and structured-clone errors in actual Jest', { timeout: 30000 }, () => {
  const root = mkdtempSync(path.join(tmpdir(), 'grafana-domexception-'));
  try {
    writeFileSync(path.join(root, 'exception.test.js'), `
      const original = DOMException;
      require(${JSON.stringify(require.resolve('core-js/stable/structured-clone'))});
      test('core-js accepts the constructor', () => {
        expect(DOMException).toBe(original);
        // Native DOMException captures its stack in Node's realm, where Jest installs source-map support.
        const HostError = require('node:vm').runInThisContext('Error');
        const prepare = Object.getOwnPropertyDescriptor(HostError, 'prepareStackTrace');
        let formatted = 0;
        try {
          HostError.prepareStackTrace = () => { formatted++; return 'lazy stack'; };
          const controller = new AbortController();
          controller.abort();
          const error = controller.signal.reason;
          expect(formatted).toBe(0);
          expect(error).toBeInstanceOf(Error);
          expect(error).toBeInstanceOf(DOMException);
          expect(error.stack).toBe('lazy stack');
          expect(formatted).toBe(1);
        } finally {
          if (prepare) Object.defineProperty(HostError, 'prepareStackTrace', prepare);
          else delete HostError.prepareStackTrace;
        }
        let cloneError;
        try { structuredClone(() => {}); } catch (error) { cloneError = error; }
        expect(cloneError).toBeInstanceOf(DOMException);
        expect(cloneError).toBeInstanceOf(Error);
        expect(cloneError.name).toBe('DataCloneError');
        expect(cloneError.code).toBe(25);
        const cloned = structuredClone(new DOMException('message', 'AbortError'));
        expect(cloned).toBeInstanceOf(DOMException);
        expect(cloned.message).toBe('message');
        expect(cloned.name).toBe('AbortError');
        expect(cloned.code).toBe(20);
      });
    `);
    const config = { rootDir: root, testEnvironment: require.resolve('../../../public/test/happy-dom-environment'),
      testMatch: ['<rootDir>/*.test.js'], transform: {}, cacheDirectory: path.join(root, 'cache') };
    const result = spawnSync(process.execPath, [require.resolve('jest/bin/jest'), '--config', JSON.stringify(config),
      '--runInBand', '--no-watch'], { encoding: 'utf8', timeout: 25000, env: { ...process.env, FORCE_COLOR: '0' } });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
