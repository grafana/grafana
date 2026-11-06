'use strict';

const { createRequire } = require('node:module');
const path = require('node:path');
const { Recorder, readConfig, attachRecorder, finalizeConstructorFailure } = require('./recorder.cjs');

let Runtime;
try {
  const jestRequire = createRequire(require.resolve('jest'));
  const coreRequire = createRequire(jestRequire.resolve('@jest/core'));
  Runtime = coreRequire('jest-runtime').default;
  const version = coreRequire('jest-runtime/package.json').version;
  assertSupportedRuntime(Runtime, version);
} catch (cause) {
  throw new Error(`Shard profiling requires installed Jest 29 CJS private runtime APIs: ${cause.message}`, { cause });
}

function assertSupportedRuntime(runtime, version) {
  if (!/^29\./.test(version) || runtime?.prototype?._execModule?.length !== 5 || runtime?.prototype?._loadModule?.length !== 6 ||
      typeof runtime?.prototype?.requireModule !== 'function' || typeof runtime?.prototype?.unstable_importModule !== 'function' ||
      runtime?.prototype?.transformFile?.length !== 2 || runtime?.prototype?.transformFileAsync?.length !== 2 ||
      runtime?.prototype?.loadEsmModule?.length !== 1 || runtime?.prototype?.linkAndEvaluateModule?.length !== 1 ||
      typeof runtime?.prototype?.teardown !== 'function') {
    throw new Error(`Unsupported jest-runtime ${version}; expected Jest 29 _execModule(5), _loadModule(6), transformFile(2), transformFileAsync(2), loadEsmModule(1), linkAndEvaluateModule(1), requireModule, unstable_importModule and teardown`);
  }
}

class ShardProfileRuntime extends Runtime {
  constructor(...args) {
    try {
      if (typeof args[3]?.transformJson !== 'function') {
        throw new Error('Unsupported Jest 29 ScriptTransformer: transformJson must be a synchronous method');
      }
      super(...args);
    } catch (error) {
      const recorder = args[1].__grafanaShardProfile;
      if (recorder) finalizeConstructorFailure(recorder);
      throw error;
    }
    const [config, environment, , , , , testPath] = args;
    let recorder = environment.__grafanaShardProfile;
    if (!recorder) {
      recorder = new Recorder(readConfig(), {
        suite: testPath,
        environment: `${environment.constructor.name} (configured: ${config.testEnvironment})`,
        coverageStart: 'runtime',
      });
      recorder.warn('Environment did not supply a recorder (for example, a docblock override); profiling begins after runtime construction.');
      attachRecorder(environment, recorder);
    }
    this.shardRecorder = new WeakRef(recorder);
    this.shardSetupFiles = new Set(config.setupFiles);
    recorder.measure(() => recorder.point('runtime_constructed'));
  }

  _execModule(localModule, options, moduleRegistry, from, moduleName) {
    const recorder = this.shardRecorder?.deref();
    if (!recorder || this.isTornDown || !this._environment.global) {
      return super._execModule(localModule, options, moduleRegistry, from, moduleName);
    }
    const frame = recorder.enterModule(localModule.filename, from);
    try {
      return super._execModule(localModule, options, moduleRegistry, from, moduleName);
    } finally {
      recorder.exitModule(frame);
    }
  }

  _loadModule(localModule, from, moduleName, modulePath, options, moduleRegistry) {
    const recorder = this.shardRecorder?.deref();
    const extension = path.extname(modulePath);
    // JavaScript delegates to _execModule; counting here as well would double count it.
    const frame = recorder && (extension === '.json' || extension === '.node')
      ? recorder.enterModule(modulePath, moduleName ? from : null)
      : null;
    const transformer = this._scriptTransformer;
    try {
      if (frame && extension === '.json') {
        // The transformer can be shared by runtimes. Override only this runtime's reference,
        // and invoke methods on their original receiver so private state and caches stay intact.
        this._scriptTransformer = new Proxy(transformer, {
          get(target, key) {
            const value = Reflect.get(target, key, target);
            if (key === 'transformJson') {
              return function (...args) {
                if (args[1]?.isInternalModule === true) return Reflect.apply(value, target, args);
                const activity = recorder.enterActivity('transform');
                try {
                  const result = Reflect.apply(value, target, args);
                  if (result && typeof result.then === 'function') recorder.invalidateActivityTiming('transformJson returned a promise');
                  return result;
                } finally {
                  recorder.exitActivity(activity);
                }
              };
            }
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set(target, key, value) {
            return Reflect.set(target, key, value, target);
          },
        });
      }
      return super._loadModule(localModule, from, moduleName, modulePath, options, moduleRegistry);
    } finally {
      this._scriptTransformer = transformer;
      if (frame) recorder.exitModule(frame);
    }
  }

  transformFile(filename, options) {
    const recorder = this.shardRecorder?.deref();
    if (!recorder || options?.isInternalModule) return super.transformFile(filename, options);
    const activity = recorder.enterActivity('transform');
    try {
      const result = super.transformFile(filename, options);
      if (result && typeof result.then === 'function') recorder.invalidateActivityTiming('transformFile returned a promise');
      return result;
    } finally {
      recorder.exitActivity(activity);
    }
  }

  transformFileAsync(filename, options) {
    this.shardRecorder?.deref()?.invalidateActivityTiming('native asynchronous transformFileAsync is unsupported');
    return super.transformFileAsync(filename, options);
  }

  loadEsmModule(modulePath, query = '') {
    this.shardRecorder?.deref()?.invalidateActivityTiming('native ESM loadEsmModule is unsupported');
    return super.loadEsmModule(modulePath, query);
  }

  linkAndEvaluateModule(module) {
    this.shardRecorder?.deref()?.invalidateActivityTiming('native ESM linkAndEvaluateModule is unsupported');
    return super.linkAndEvaluateModule(module);
  }

  requireModule(from, moduleName, options, isRequireActual) {
    const recorder = this.shardRecorder?.deref();
    const earlySetup = recorder && !recorder.runStarted && !recorder.moduleStack.length &&
      moduleName === undefined && this.shardSetupFiles?.delete(from);
    if (!earlySetup) return super.requireModule(from, moduleName, options, isRequireActual);

    // Jest 29 runs setupFiles outside runTest's teardown finally. Its function-export await is
    // the only place to finish cleanup before rethrowing an early error without replacing Circus.
    let exported;
    try {
      exported = super.requireModule(from, moduleName, options, isRequireActual);
    } catch (error) {
      return () => this.failEarlySetup(error);
    }
    if (typeof exported !== 'function') return exported;
    const runtime = this;
    return function (...args) {
      let result;
      try {
        result = Reflect.apply(exported, this, args);
      } catch (error) {
        return runtime.failEarlySetup(error);
      }
      return result && typeof result.then === 'function'
        ? Promise.resolve(result).catch((error) => runtime.failEarlySetup(error))
        : result;
    };
  }

  async unstable_importModule(from, moduleName) {
    const recorder = this.shardRecorder?.deref();
    recorder?.invalidateActivityTiming('native ESM unstable_importModule is unsupported');
    const earlySetup = recorder && !recorder.runStarted && moduleName === undefined && this.shardSetupFiles?.delete(from);
    try {
      return await super.unstable_importModule(from, moduleName);
    } catch (error) {
      if (earlySetup) return this.failEarlySetup(error);
      throw error;
    }
  }

  async failEarlySetup(error) {
    const environment = this._environment;
    const recorder = this.shardRecorder?.deref();
    if (recorder) {
      recorder.failed = true;
      recorder.warn('setupFiles failed before Jest 29 entered its teardown guard; the custom runtime performed cleanup.');
    }
    const cleanupErrors = [];
    try { this.teardown(); } catch (failure) { cleanupErrors.push(failure); }
    try { await environment.teardown(); } catch (failure) { cleanupErrors.push(failure); }
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], 'Jest setup and shard profile cleanup failed', { cause: error });
    }
    throw error;
  }

  teardown() {
    const recorder = this.shardRecorder?.deref();
    recorder?.beginTeardown();
    try {
      return super.teardown();
    } finally {
      this.shardRecorder = null;
      this.shardSetupFiles?.clear();
    }
  }
}

module.exports = ShardProfileRuntime;
module.exports.assertSupportedRuntime = assertSupportedRuntime;
