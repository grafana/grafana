const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const compiler = require('sucrase');

test('Happy DOM configuration uses the pinned Sucrase adapter without changing other Jest behavior', () => {
  const base = require('../../../jest.config');
  const config = require('../../../jest.happy-dom.config');
  const { transform, testEnvironment, ...rest } = config;
  const { transform: baseTransform, testEnvironment: baseEnvironment, ...baseRest } = base;
  assert.deepEqual(rest, baseRest);
  assert.equal(baseEnvironment, 'jsdom');
  const pattern = '^.+\\.(ts|tsx|js|jsx|mjs)$';
  assert.equal(baseTransform[pattern][0], require.resolve('ts-jest'));
  assert.equal(testEnvironment, '<rootDir>/public/test/happy-dom-environment.js');
  assert.deepEqual(Object.keys(transform), [pattern]);
  assert.deepEqual(Object.keys(transform), Object.keys(baseTransform));
  const [adapter, options] = transform[pattern];
  assert.equal(adapter, require.resolve('@sucrase/jest-plugin'));
  assert.equal(createRequire(adapter).resolve('sucrase'), require.resolve('sucrase'));
  assert.deepEqual(options, {
    jsxRuntime: 'automatic',
    production: true,
    disableESTransforms: false,
    preserveDynamicImport: false,
  });
  const { scripts } = require('../../../package.json');
  assert.equal(scripts['test:transformer'], 'node --test scripts/test-harness/compiler/jest-sucrase.test.cjs');
  assert.ok(scripts['test:ci'].startsWith('pnpm run test:transformer && '));
  assert.ok(scripts['test:ci'].includes('jest --config=jest.happy-dom.config.js --ci'));
});

function transformWithAdapter(source, filename) {
  const config = require('../../../jest.happy-dom.config');
  const entry = Object.entries(config.transform).find(([pattern]) => new RegExp(pattern).test(filename));
  assert.ok(entry, `The Happy DOM configuration must transform ${filename}`);
  const [adapter, transformerConfig] = entry[1];
  return require(adapter).process(source, filename, {
    supportsStaticESM: false,
    supportsDynamicImport: false,
    transformerConfig,
  }).code;
}

test('Happy DOM Jest adapter transforms mjs imports and exports', () => {
  const code = transformWithAdapter(
    'import { value } from "dependency"; export const answer = value + 2;',
    'fixture.mjs'
  );
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => {
      assert.equal(name, 'dependency');
      return { value: 40 };
    },
    module,
    module.exports
  );
  assert.equal(module.exports.answer, 42);
});

test('Happy DOM Jest adapter hoists mocks before static imports', () => {
  const code = transformWithAdapter(
    `
    import { value } from "dependency";
    jest.mock("dependency", () => ({ value: 40 }));
    export const answer = value + 2;
  `,
    'fixture.ts'
  );
  const mocks = new Map();
  const events = [];
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'jest', code)(
    (name) => {
      events.push(`require:${name}`);
      assert.ok(mocks.has(name), 'The mock must register before the import');
      return mocks.get(name)();
    },
    module,
    module.exports,
    {
      mock(name, factory) {
        events.push(`mock:${name}`);
        mocks.set(name, factory);
      },
    }
  );
  assert.deepEqual(events, ['mock:dependency', 'require:dependency']);
  assert.equal(module.exports.answer, 42);
});

test('Happy DOM Jest adapter converts dynamic imports to deferred CommonJS loads', async () => {
  const code = transformWithAdapter('export const load = () => import("dependency");', 'fixture.ts');
  const imports = [];
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => {
      imports.push(name);
      return { value: 42 };
    },
    module,
    module.exports
  );
  const pending = module.exports.load();
  assert.deepEqual(imports, []);
  const imported = await pending;
  assert.deepEqual(imports, ['dependency']);
  assert.equal(imported.value, 42);
});

function modules(sources) {
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) {
      return cache.get(name).exports;
    }
    assert.ok(Object.hasOwn(sources, name), `Unexpected import: ${name}`);
    const module = { exports: {} };
    cache.set(name, module);
    const result = compiler.transform(sources[name], {
      transforms: ['typescript', 'imports'],
      filePath: name + '.ts',
      disableESTransforms: false,
    });
    new Function('require', 'module', 'exports', result.code)(load, module, module.exports);
    return module.exports;
  }
  return load;
}

for (const [name, prefix, expected] of [
  ['leading JSX import-source directive', '/** @jsxImportSource @emotion/react */', '@emotion/react/jsx-runtime'],
  [
    'directive after another comment',
    '/* eslint-disable */\n/** @jsxImportSource @emotion/react */',
    '@emotion/react/jsx-runtime',
  ],
  ['multiline directive', '/**\n * @jsxImportSource @emotion/react\n */', '@emotion/react/jsx-runtime'],
  ['default runtime', '', 'react/jsx-runtime'],
  ['directive-like string', 'const text = "/** @jsxImportSource wrong */";', 'react/jsx-runtime'],
  ['directive-like line comment', '// /** @jsxImportSource wrong */\n', 'react/jsx-runtime'],
]) {
  test(name, () => {
    const result = compiler.transform(prefix + '\nexport const element = <div css="style" />;', {
      transforms: ['typescript', 'jsx', 'imports'],
      filePath: 'fixture.tsx',
      jsxRuntime: 'automatic',
      production: true,
    });
    const imports = [];
    const exports = {};
    new Function('require', 'exports', result.code)((name) => {
      imports.push(name);
      return { jsx: (tag, props) => ({ tag, props }) };
    }, exports);
    assert.deepEqual(imports, [expected]);
    assert.deepEqual(exports.element, { tag: 'div', props: { css: 'style' } });
  });
}

const declarations = [
  ['const', 'export const value = 2;', (m) => m.value],
  ['let', 'export let value = 2;', (m) => m.value],
  ['var', 'export var value = 2;', (m) => m.value],
  ['destructuring', 'export const { value } = { value: 2 };', (m) => m.value],
  ['array destructuring', 'export const [value] = [2];', (m) => m.value],
  ['function', 'export function value() { return 2; }', (m) => m.value()],
  ['generator', 'export function* value() { yield 2; }', (m) => m.value().next().value],
  ['async function', 'export async function value() { return 2; }', (m) => m.value()],
  ['class', 'export class value { static answer = 2; }', (m) => m.value.answer],
  ['abstract class', 'export abstract class value { static answer = 2; }', (m) => m.value.answer],
  ['enum', 'export enum value { Entry = 2 }', (m) => m.value.Entry],
  ['const enum', 'export const enum value { Entry = 2 }', (m) => m.value.Entry],
  ['local alias', 'const local = 2; export { local as value };', (m) => m.value],
  ['named re-export', 'export { answer as value } from "override";', (m) => m.value],
  ['namespace re-export', 'export * as value from "override";', (m) => m.value.answer],
];

for (const [name, declaration, read] of declarations) {
  for (const starFirst of [true, false]) {
    test(`explicit ${name} wins with star export ${starFirst ? 'first' : 'last'}`, async () => {
      const star = 'export * from "generated";';
      const load = modules({
        generated: 'export const value = 1; export const untouched = 9;',
        override: 'export const answer = 2;',
        veneer: starFirst ? star + declaration : declaration + star,
      });
      const veneer = load('veneer');
      assert.equal(await read(veneer), 2);
      assert.equal(veneer.untouched, 9);
    });
  }
}

for (const declaration of [
  'export interface value {}',
  'export type value = string;',
  'interface value {} export { value };',
  'export type { value } from "types";',
  'export { type value } from "types";',
  'export declare const value: number;',
]) {
  test(`erased declaration does not hide star export: ${declaration}`, () => {
    const load = modules({ generated: 'export const value = 7;', veneer: 'export * from "generated";' + declaration });
    assert.equal(load('veneer').value, 7);
  });
}

for (const [name, declaration, read] of [
  ['function', 'export function value() { return 2; }', (result) => result],
  ['async function', 'export async function value() { return 2; }', (result) => result],
  ['generator', 'export function* value() { yield 2; }', (result) => result.next().value],
  ['async generator', 'export async function* value() { yield 2; }', async (result) => (await result.next()).value],
  [
    'overloaded function',
    'export function value(): number; export function value(): number { return 2; }',
    (result) => result,
  ],
]) {
  test(`publishes ${name} before a circular dependency calls or copies it`, async () => {
    const load = modules({
      source: `import "consumer"; ${declaration}`,
      consumer:
        'import * as source from "source"; export const snapshot = { ...source }; export const answer = source.value();',
    });
    const source = load('source');
    const consumer = load('consumer');
    assert.equal(await read(consumer.answer), 2);
    assert.equal(await read(consumer.snapshot.value()), 2);
    assert.equal(consumer.snapshot.value, source.value);
    assert.deepEqual(Object.getOwnPropertyDescriptor(source, 'value'), {
      value: source.value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  });
}

test('does not overwrite a function replacement installed during a circular import', () => {
  const load = modules({
    source: 'import "consumer"; export function value() { return 2; }',
    consumer: `
      import * as source from "source";
      const original = source.value;
      source.value = () => 7;
      export function restore() { source.value = original; }
    `,
  });
  const source = load('source');
  assert.equal(source.value(), 7);
  load('consumer').restore();
  assert.equal(source.value(), 2);
});

test('keeps reassigned function exports live after their initial publication', () => {
  const load = modules({
    source: 'export function value() { return 2; } export function replace() { value = () => 7; }',
    consumer: 'import { value } from "source"; export function read() { return value(); }',
  });
  const consumer = load('consumer');
  assert.equal(consumer.read(), 2);
  load('source').replace();
  assert.equal(consumer.read(), 7);
});

test('does not hoist class or variable initializers alongside function exports', () => {
  const load = modules({
    source: `
      import "consumer";
      export const value = 2;
      export const fn = () => value;
      export class C { static value = 3; }
      export function read() { return value; }
    `,
    consumer: 'import * as source from "source"; export const snapshot = { ...source };',
  });
  const source = load('source');
  const snapshot = load('consumer').snapshot;
  assert.equal(snapshot.value, undefined);
  assert.equal(snapshot.fn, undefined);
  assert.equal(snapshot.C, undefined);
  assert.equal(snapshot.read(), 2);
  assert.equal(source.fn(), 2);
  assert.equal(source.C.value, 3);
});

test('retains live re-exports and configurable function getters after excluding explicit exports', () => {
  const load = modules({
    generated: 'export let count = 1; export function bump() { count++; } export const value = 0;',
    veneer: 'export * from "generated"; export const value = 2;',
  });
  const veneer = load('veneer');
  assert.equal(veneer.count, 1);
  veneer.bump();
  assert.equal(veneer.count, 2);
  assert.equal(load('generated').count, 2);
  const descriptor = Object.getOwnPropertyDescriptor(veneer, 'bump');
  assert.equal(descriptor.configurable, true);
  assert.equal(typeof descriptor.get, 'function');
  const replacement = () => 42;
  Object.defineProperty(veneer, 'bump', { configurable: true, value: replacement });
  assert.equal(veneer.bump(), 42);
  Object.defineProperty(veneer, 'bump', descriptor);
  veneer.bump();
  assert.equal(veneer.count, 3);
  assert.equal(veneer.value, 2);
});

test('excludes explicit names across multiple stars without hiding unrelated exports', () => {
  const load = modules({
    first: 'export const value = 0; export const a = 1;',
    second: 'export const value = 9; export const b = 2;',
    veneer: 'export * from "first"; export const value = 3; export * from "second";',
  });
  assert.equal(load('veneer').value, 3);
  assert.equal(load('veneer').a, 1);
  assert.equal(load('veneer').b, 2);
});

test('generated exclusion name does not collide with a source binding', () => {
  const load = modules({
    generated: 'export const value = 0;',
    veneer: 'export * from "generated"; const _explicitExports = 2; export const value = _explicitExports;',
  });
  assert.equal(load('veneer').value, 2);
});

for (const kind of ['const', 'let', 'var']) {
  test(`comma-separated ${kind} exports initialize in order and retain inferred names`, () => {
    const load = modules({
      source: `export ${kind} a = 2, b = a + 3, fn = () => b, C = class {};`,
    });
    const source = load('source');
    assert.equal(source.a, 2);
    assert.equal(source.b, 5);
    assert.equal(source.fn(), 5);
    assert.equal(source.fn.name, 'fn');
    assert.equal(source.C.name, 'C');
  });
}

test('type annotation parameters do not replace non-exported local references', () => {
  const load = modules({
    source:
      'const value = 7; export const identity: (value: number) => number = (arg) => arg; export const observed = value;',
  });
  const source = load('source');
  assert.equal(source.identity(11), 11);
  assert.equal(source.observed, 7);
  assert.equal(Object.hasOwn(source, 'value'), false);
});

test('defaulted generic type annotations do not become runtime initializers', () => {
  const load = modules({
    source: 'export const identity: <T = number>(value: T) => T = (value) => value, observed = identity(7);',
  });
  const source = load('source');
  assert.equal(source.observed, 7);
  assert.equal(source.identity('text'), 'text');
});

test('mixed destructuring and typed declarators override stars without exporting initializer locals', () => {
  const load = modules({
    generated: 'export const a = 0; export const b = 0; export const c = 0; export const value = 11;',
    source:
      'export * from "generated"; export const a: number = 2, {b} = {b: a + 1}, [c] = [b + 1], d = (() => { const value = 9; return value; })();',
  });
  const source = load('source');
  assert.equal(source.a, 2);
  assert.equal(source.b, 3);
  assert.equal(source.c, 4);
  assert.equal(source.d, 9);
  assert.equal(source.value, 11);
});

for (const [name, declaration, read] of [
  ['optional method', 'method?(x: number): number { return this.field + x; }', (m) => new m.C().method(3)],
  [
    'optional generic method',
    'method?<T extends number>(x: T): number { return this.field + x; }',
    (m) => new m.C().method(3),
  ],
  [
    'optional async method',
    'async method?(x: number): Promise<number> { return this.field + x; }',
    (m) => new m.C().method(3),
  ],
  ['optional static method', 'static method?(x: number): number { return x + 2; }', (m) => m.C.method(3)],
]) {
  test(`${name} retains its body with class-field transforms enabled`, async () => {
    const load = modules({ source: `export class C { field = 2; ${declaration} other = 7; }` });
    assert.equal(await read(load('source')), 5);
    assert.equal(new (load('source').C)().other, 7);
  });
}

test('optional type-only members remain erased', () => {
  const load = modules({
    source: 'export abstract class C { optional?: number; abstract method?(x: number): number; field = 2; }',
  });
  const instance = new (load('source').C)();
  assert.equal(instance.field, 2);
  assert.equal(Object.hasOwn(instance, 'optional'), false);
  assert.equal('method' in instance, false);
});

test('prototype-like names do not mask unrelated star exports', () => {
  const load = modules({
    generated: 'export const constructor = 1; export const toString = 2; export const other = 3;',
    veneer: 'export const hasOwnProperty = 7; export * from "generated"; export const constructor = 4;',
  });
  assert.equal(load('veneer').hasOwnProperty, 7);
  assert.equal(load('veneer').constructor, 4);
  assert.equal(load('veneer').toString, 2);
  assert.equal(load('veneer').other, 3);
});
