beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  localStorage.removeItem('store-entry-point-regression');
  jest.resetModules();
});

it('reads, writes, and observes storage without loading the data barrel', () => {
  const { store } = require('@grafana/data/store') as typeof import('@grafana/data/store');
  const key = 'store-entry-point-regression';
  const changed = jest.fn();
  const unsubscribe = store.subscribe(key, changed);

  try {
    store.setObject(key, { origin: 'https://example.com' });
    expect(store.getObject(key)).toEqual({ origin: 'https://example.com' });
    expect(changed).toHaveBeenCalledTimes(1);

    localStorage.setItem(key, JSON.stringify({ origin: 'https://other.example.com' }));
    window.dispatchEvent(new StorageEvent('storage', { key }));
    expect(store.getObject(key)).toEqual({ origin: 'https://other.example.com' });
    expect(changed).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.delete(key);
    expect(store.getObject(key)).toBeUndefined();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(require.cache[require.resolve('@grafana/data')]).toBeUndefined();
  } finally {
    unsubscribe();
  }
});

it('shares the existing public store singleton', () => {
  const narrow = require('@grafana/data/store') as typeof import('@grafana/data/store');
  const existing = require('@grafana/data') as typeof import('@grafana/data');
  expect(narrow.store).toBe(existing.store);
});
