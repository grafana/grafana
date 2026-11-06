import { jestDomMatchers } from '../../../public/test/lazyJestDomMatchers';

const matcherModule = '@testing-library/jest-dom/matchers';
const loadMatchers = () =>
  require('../../../public/test/lazyJestDomMatchers') as typeof import('../../../public/test/lazyJestDomMatchers');

type AsymmetricDomMatchers = {
  toHaveTextContent(text: string): { asymmetricMatch(received: unknown): boolean };
};
const domExpect = expect as typeof expect & AsymmetricDomMatchers & { not: AsymmetricDomMatchers };

afterEach(() => {
  jest.dontMock('@testing-library/jest-dom');
  jest.dontMock(matcherModule);
  expect.extend(jestDomMatchers);
});

it('loads the public matcher entry only on first use and never loads the eager entry', () => {
  jest.isolateModules(() => {
    const rootLoad = jest.fn(() => {
      throw new Error('The eager jest-dom entry point must not be loaded');
    });
    const implementation = jest.fn(() => ({ pass: true, message: () => 'matched' }));
    const matcherLoad = jest.fn(() => ({ toHaveTextContent: implementation }));
    jest.doMock('@testing-library/jest-dom', rootLoad);
    jest.doMock(matcherModule, matcherLoad);

    const { jestDomMatchers: lazy } = loadMatchers();
    expect.extend(lazy);
    expect(matcherLoad).toHaveBeenCalledTimes(0);
    expect(rootLoad).toHaveBeenCalledTimes(0);

    const element = document.createElement('div');
    expect(element).toHaveTextContent('ready');
    expect(element).toHaveTextContent('ready');
    expect(matcherLoad).toHaveBeenCalledTimes(1);
    expect(rootLoad).toHaveBeenCalledTimes(0);
    expect(implementation.mock.calls).toEqual([
      [element, 'ready'],
      [element, 'ready'],
    ]);
  });
});

it('covers exactly the matcher names exported by the public entry point, including deprecated aliases', () => {
  const actual = jest.requireActual(matcherModule);
  expect(Object.keys(jestDomMatchers).sort()).toEqual(Object.keys(actual).sort());
});

it.each(['synchronous', 'promise'] as const)('preserves context, arguments, and the original %s result', (kind) => {
  jest.isolateModules(() => {
    const result = { pass: false, message: () => 'expected ready, received waiting' };
    const returned = kind === 'promise' ? Promise.resolve(result) : result;
    const implementation = jest.fn(() => returned);
    jest.doMock(matcherModule, () => ({ toHaveTextContent: implementation }));

    const { jestDomMatchers: lazy } = loadMatchers();
    const context = { isNot: true, promise: 'resolves' } as jest.MatcherContext;
    const element = document.createElement('div');
    const args: Parameters<jest.CustomMatcher> = [element, /ready/, { normalizeWhitespace: false }];
    expect(lazy.toHaveTextContent.apply(context, args)).toBe(returned);
    expect(implementation.mock.calls).toEqual([args]);
    expect(implementation.mock.contexts).toEqual([context]);
  });
});

it('propagates the original thrown error without wrapping or swallowing it', () => {
  jest.isolateModules(() => {
    const error = new TypeError('received value must be a Node');
    jest.doMock(matcherModule, () => ({
      toHaveTextContent: () => {
        throw error;
      },
    }));

    const { jestDomMatchers: lazy } = loadMatchers();
    let thrown: unknown;
    try {
      lazy.toHaveTextContent.call({} as jest.MatcherContext, null, 'ready');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(error);
  });
});

it('preserves normal, negated, asymmetric, and promise contexts with real matchers', async () => {
  await jest.isolateModulesAsync(async () => {
    const actual = jest.requireActual<Record<string, jest.CustomMatcher>>(matcherModule);
    const implementation = jest.fn(actual.toHaveTextContent);
    jest.doMock(matcherModule, () => ({ ...actual, toHaveTextContent: implementation }));
    expect.extend(loadMatchers().jestDomMatchers);

    const element = document.createElement('div');
    element.textContent = 'ready';
    expect(element).toHaveTextContent('ready');
    expect(element).not.toHaveTextContent('waiting');
    expect({ element }).toEqual({ element: domExpect.toHaveTextContent('ready') });
    expect({ element }).toEqual({ element: domExpect.not.toHaveTextContent('waiting') });
    await expect(Promise.resolve(element)).resolves.toHaveTextContent('ready');
    await expect(Promise.reject(element)).rejects.toHaveTextContent('ready');

    expect(implementation.mock.calls).toEqual([
      [element, 'ready'],
      [element, 'waiting'],
      [element, 'ready'],
      [element, 'waiting'],
      [element, 'ready'],
      [element, 'ready'],
    ]);
    expect(implementation.mock.contexts).toEqual([
      expect.objectContaining({ isNot: false, promise: '' }),
      expect.objectContaining({ isNot: true, promise: '' }),
      expect.objectContaining({ isNot: false }),
      expect.objectContaining({ isNot: true }),
      expect.objectContaining({ isNot: false, promise: 'resolves' }),
      expect.objectContaining({ isNot: false, promise: 'rejects' }),
    ]);
  });
});

it('retains useful assertion failures and invalid-element diagnostics from the real matchers', () => {
  const element = document.createElement('div');
  element.textContent = 'ready';

  expect(() => expect(element).toHaveTextContent('waiting')).toThrow(
    /Expected element to have text content:[\s\S]*waiting[\s\S]*Received:[\s\S]*ready/
  );
  expect(() => expect(element).not.toHaveTextContent('ready')).toThrow(
    /Expected element not to have text content:[\s\S]*ready[\s\S]*Received:[\s\S]*ready/
  );
  expect(() => expect('not an element').toBeInTheDocument()).toThrow(
    /received value must be an HTMLElement or an SVGElement/
  );
});
