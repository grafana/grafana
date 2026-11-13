import { createRequire } from 'node:module';
import path from 'node:path';

import { loadBenchmarkConfig } from '../../../jest-benchmark-config.mts';

type JestConfiguration = Record<string, unknown>;

function readConfiguration(requireFromCheckout: ReturnType<typeof createRequire>, filename: string): JestConfiguration {
  const config: unknown = requireFromCheckout(filename);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${filename} must export a Jest configuration object`);
  }
  return config as JestConfiguration;
}

function validateTransform(
  config: JestConfiguration,
  filename: string,
  transformer: string,
  transformerModule: string,
  resolve: (specifier: string, label: string) => string
) {
  if (!config.transform || typeof config.transform !== 'object' || Array.isArray(config.transform)) {
    throw new Error(`${filename} must configure ${transformer} in a transform table`);
  }
  let found = false;
  for (const [pattern, entry] of Object.entries(config.transform)) {
    try {
      new RegExp(pattern);
    } catch (cause) {
      throw new Error(`${filename} has an invalid transform pattern ${JSON.stringify(pattern)}`, { cause });
    }
    const tuple = Array.isArray(entry) ? entry : [entry];
    if (tuple.length < 1 || tuple.length > 2 || typeof tuple[0] !== 'string' || !tuple[0].trim() ||
        (tuple.length === 2 && tuple[1] !== undefined && (!tuple[1] || typeof tuple[1] !== 'object' || Array.isArray(tuple[1])))) {
      throw new Error(`${filename} transform ${JSON.stringify(pattern)} must be a module string or [module, options] tuple`);
    }
    if (resolve(tuple[0], `transformer in ${filename}`) === transformerModule) found = true;
  }
  if (!found) throw new Error(`${filename} must configure the checkout's ${transformer} adapter (${transformerModule})`);
}

export async function loadProfileConfiguration(
  rootDir: string,
  shard: string,
  environment: string = 'happy-dom',
  transformer?: string
) {
  if (environment !== 'happy-dom' && environment !== 'jsdom') {
    throw new Error(`Invalid environment ${JSON.stringify(environment)}: expected happy-dom or jsdom`);
  }
  const defaultTransformer = environment === 'happy-dom' ? 'sucrase' : 'ts-jest';
  if (transformer === undefined) transformer = defaultTransformer;
  if (transformer !== 'sucrase' && transformer !== 'ts-jest') {
    throw new Error(`Invalid transformer ${JSON.stringify(transformer)}: expected sucrase or ts-jest`);
  }

  const root = path.resolve(rootDir);
  const benchmark = await loadBenchmarkConfig(root, environment, shard);
  const requireFromCheckout = createRequire(path.join(root, 'package.json'));
  function resolve(specifier: string, label: string): string {
    const request = specifier.startsWith('<rootDir>/') ? path.resolve(root, specifier.slice(10)) : specifier;
    try {
      const filename = requireFromCheckout.resolve(request);
      if (!path.isAbsolute(filename)) throw new Error('Expected a file, not a Node builtin');
      return filename;
    } catch (cause) {
      throw new Error(`Cannot resolve ${label} ${JSON.stringify(specifier)} from checkout ${root}`, { cause });
    }
  }

  const baseConfigPath = path.resolve(root, benchmark.jestConfig);
  const base = readConfiguration(requireFromCheckout, baseConfigPath);
  if (base.runtime !== undefined && base.runtime !== null) {
    throw new Error(`${baseConfigPath}: this profiler cannot replace another custom Jest runtime`);
  }
  if (base.testRunner !== undefined && base.testRunner !== null && base.testRunner !== 'jest-circus/runner') {
    const message = `${baseConfigPath}: this profiler requires the default Jest Circus runner`;
    try {
      if (typeof base.testRunner !== 'string' ||
          resolve(base.testRunner, 'testRunner') !== resolve('jest-circus/runner', 'default testRunner')) {
        throw new Error(message);
      }
    } catch (cause) {
      throw new Error(message, { cause });
    }
  }

  let environmentModule = benchmark.testEnvironment;
  if (environment === 'happy-dom') {
    const expected = path.join(root, 'public/test/happy-dom-environment.js');
    if (path.resolve(root, environmentModule) !== expected) {
      throw new Error('This profiler requires the configured Grafana Happy DOM environment (public/test/happy-dom-environment.js)');
    }
    environmentModule = expected;
  } else if (environmentModule === 'jsdom') {
    environmentModule = 'jest-environment-jsdom';
  }
  const configuredEnvironment = resolve(environmentModule, 'test environment');

  let transformConfigPath = baseConfigPath;
  let transformConfig = base;
  if (transformer !== defaultTransformer) {
    // Only the transform table is borrowed; the selected benchmark retains its environment and roster.
    const donorEnvironment = environment === 'happy-dom' ? 'jsdom' : 'happy-dom';
    const donor = await loadBenchmarkConfig(root, donorEnvironment, shard);
    transformConfigPath = path.resolve(root, donor.jestConfig);
    transformConfig = readConfiguration(requireFromCheckout, transformConfigPath);
  }
  const adapter = transformer === 'sucrase' ? '@sucrase/jest-plugin' : 'ts-jest';
  const transformerModule = resolve(adapter, `${transformer} adapter`);
  validateTransform(transformConfig, transformConfigPath, transformer, transformerModule, resolve);
  const jest = resolve('jest/bin/jest', 'Jest executable');

  return { environment, transformer, benchmark, baseConfigPath, transformConfigPath, configuredEnvironment, transformerModule, jest };
}
