import { createRequire } from 'node:module';
import path from 'node:path';

// Resolve the comparator from the package that owns it, not the root workspace.
const requireFromTestUtils = createRequire(path.resolve(__dirname, '../../../packages/grafana-test-utils/package.json'));
const canvasModule = requireFromTestUtils.resolve('jest-canvas-mock-compare');

const observableModules = {
  toEmitValues: require.resolve('../../../packages/grafana-test-utils/src/matchers/toEmitValues'),
  toEmitValuesWith: require.resolve('../../../packages/grafana-test-utils/src/matchers/toEmitValuesWith'),
};

const loadMatchers = () =>
  require('../../../packages/grafana-test-utils/src/matchers') as typeof import('../../../packages/grafana-test-utils/src/matchers');

afterEach(() => {
  jest.dontMock(canvasModule);
  for (const module of Object.values(observableModules)) {
    jest.dontMock(module);
  }
});

it('loads the canvas comparator on first use and forwards the matcher context, arguments, and return value', () => {
  jest.isolateModules(() => {
    let loads = 0;
    const result = { pass: true, message: () => 'canvas result' };
    const comparator = jest.fn(() => result);
    jest.doMock(canvasModule, () => {
      loads++;
      return { matchers: { toMatchCanvasSnapshot: comparator } };
    });

    const { matchers } = loadMatchers();
    expect(loads).toBe(0);

    const context = { currentTestName: 'canvas forwarding', isNot: false } as jest.MatcherContext;
    const invoke = matchers.toMatchCanvasSnapshot as jest.CustomMatcher;
    const args: Parameters<jest.CustomMatcher> = [
      [],
      [],
      { width: 100, height: 50 },
      'canvas hint',
      { property: 'value' },
      'snapshot hint',
    ];
    expect(invoke.apply(context, args)).toBe(result);
    expect(invoke.apply(context, args)).toBe(result);
    expect(loads).toBe(1);
    expect(comparator.mock.calls).toEqual([args, args]);
    expect(comparator.mock.contexts).toEqual([context, context]);
  });
});

it('propagates comparator errors without converting them into passing matcher results', () => {
  jest.isolateModules(() => {
    const error = new Error('canvas comparison failed');
    jest.doMock(canvasModule, () => ({
      matchers: {
        toMatchCanvasSnapshot: () => {
          throw error;
        },
      },
    }));

    const { matchers } = loadMatchers();
    const invoke = matchers.toMatchCanvasSnapshot as jest.CustomMatcher;
        expect(() => invoke.call({} as jest.MatcherContext, [], [], { width: 1, height: 1 })).toThrow(error);
  });
});

it.each(['toEmitValues', 'toEmitValuesWith'] as const)(
  'loads %s only when called and returns its original promise',
  (name) => {
    jest.isolateModules(() => {
      let loads = 0;
      const promise = Promise.resolve({ pass: false, message: () => 'original result' });
      const implementation = jest.fn(() => promise);
      jest.doMock(observableModules[name], () => {
        loads++;
        return { [name]: implementation };
      });

      const { matchers } = loadMatchers();
      expect(loads).toBe(0);
      const received = { subscribe: jest.fn() };
      const expectation = name === 'toEmitValues' ? [1] : jest.fn();
      const invoke = matchers[name] as jest.CustomMatcher;
      const context = {} as jest.MatcherContext;
      expect(invoke.call(context, received, expectation)).toBe(promise);
      expect(invoke.call(context, received, expectation)).toBe(promise);
      expect(loads).toBe(1);
      expect(implementation.mock.calls).toEqual([
        [received, expectation],
        [received, expectation],
      ]);
    });
  }
);

it('registers every canvas matcher exported by the installed comparator', () => {
  const { matchers } = loadMatchers();
  const { matchers: canvas } = jest.requireActual<{ matchers: Record<string, jest.CustomMatcher> }>(canvasModule);
  expect(Object.keys(matchers).sort()).toEqual([...Object.keys(canvas), 'toEmitValues', 'toEmitValuesWith'].sort());
});
