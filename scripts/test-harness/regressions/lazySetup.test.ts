const eagerModules = ['@testing-library/react', '@testing-library/dom', 'react-i18next'].filter(
  (name) => require.cache[require.resolve(name)]
);

it('does not load React or the testing-library query entry during shared setup', () => {
  expect(eagerModules).toEqual([]);
});

it('configures the real DOM testing library without replacing its implementation', () => {
  const library = require('@testing-library/dom') as typeof import('@testing-library/dom');

  expect(library).toBe(jest.requireActual('@testing-library/dom'));
  expect(library.getConfig().asyncUtilTimeout).toBe(2000);
  library.configure({ asyncUtilTimeout: 2500 });
  expect(require('@testing-library/dom').getConfig().asyncUtilTimeout).toBe(2500);
  library.configure({ asyncUtilTimeout: 2000 });
});

it('retains the initialized translation instance when React translations load later', () => {
  const i18n = require('i18next') as typeof import('i18next').default;
  const { getI18n } = require('react-i18next') as typeof import('react-i18next');

  expect(i18n).toBe(jest.requireActual('i18next'));
  expect(getI18n()).toBe(i18n);
  expect(i18n.isInitialized).toBe(true);
  expect(i18n.language).toBe('en-US');
  i18n.addResourceBundle('en-US', 'lazy-setup', { greeting: 'Hello {{name}}', empty: '' });
  expect(i18n.t('greeting', { ns: 'lazy-setup', name: 'Grafana' })).toBe('Hello Grafana');
  expect(i18n.t('empty', { ns: 'lazy-setup', defaultValue: 'Fallback' })).toBe('Fallback');
});

it('preserves module isolation after the libraries load in the outer registry', () => {
  const i18n = require('i18next') as typeof import('i18next').default;
  const library = require('@testing-library/dom') as typeof import('@testing-library/dom');

  jest.isolateModules(() => {
    const isolatedI18n = require('i18next') as typeof import('i18next').default;
    const isolatedLibrary = require('@testing-library/dom') as typeof import('@testing-library/dom');
    expect(isolatedI18n).not.toBe(i18n);
    expect(isolatedLibrary).not.toBe(library);
    expect(isolatedI18n.options.resources).toBeUndefined();
    isolatedLibrary.configure({ asyncUtilTimeout: 3500 });
    expect(isolatedLibrary.getConfig().asyncUtilTimeout).toBe(3500);
  });

  expect(library.getConfig().asyncUtilTimeout).toBe(2000);
  expect(i18n.isInitialized).toBe(true);
});
