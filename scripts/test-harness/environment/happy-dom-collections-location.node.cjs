const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let Window;
before(async () => {
  ({ Window } = await import('happy-dom'));
});

function createWindow(t, options) {
  const window = new Window({ url: 'https://example.test:8443/docs?view=1#start', ...options });
  t.after(() => window.happyDOM.close());
  return window;
}

for (const tag of ['thead', 'tbody', 'tfoot']) {
  test(`${tag}.rows is a cached live collection of direct HTML rows`, (t) => {
    const window = createWindow(t);
    const { document } = window;
    const section = document.createElement(tag);
    const rows = section.rows;
    assert.ok(rows instanceof window.HTMLCollection);
    assert.equal(rows.length, 0);
    assert.strictEqual(section.rows, rows);

    section.innerHTML =
      '<tr id="first"><td><table><tbody><tr id="nested"></tr></tbody></table></td></tr><tr id="last"></tr>';
    const first = section.firstElementChild;
    const last = section.lastElementChild;
    section.append(document.createElementNS('http://www.w3.org/2000/svg', 'tr'));
    assert.deepEqual(Array.from(rows), [first, last]);
    assert.strictEqual(rows[0], first);
    assert.strictEqual(rows.item(1), last);
    assert.strictEqual(rows.namedItem('first'), first);

    section.insertBefore(last, first);
    assert.deepEqual(Array.from(rows), [last, first]);
    first.remove();
    assert.deepEqual(Array.from(rows), [last]);
    section.textContent = '';
    assert.equal(rows.length, 0);
    assert.strictEqual(section.rows, rows);
  });
}

test('retained row collections follow reparenting without replacing the collection', (t) => {
  const { document } = createWindow(t);
  const first = document.createElement('tbody');
  const second = document.createElement('tbody');
  const firstRows = first.rows;
  const secondRows = second.rows;
  const row = first.insertRow();
  assert.deepEqual(Array.from(firstRows), [row]);
  assert.equal(secondRows.length, 0);

  second.append(row);
  assert.equal(firstRows.length, 0);
  assert.deepEqual(Array.from(secondRows), [row]);
  assert.strictEqual(first.rows, firstRows);
  assert.strictEqual(second.rows, secondRows);

  const clone = second.cloneNode(true);
  assert.notStrictEqual(clone.rows, secondRows);
  assert.strictEqual(clone.rows[0], clone.firstElementChild);
  second.deleteRow(0);
  assert.equal(secondRows.length, 0);
  assert.equal(clone.rows.length, 1);
});

const urlAttributes = ['href', 'origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash'];
const snapshot = (location) => Object.fromEntries(urlAttributes.map((name) => [name, location[name]]));

test('Location URL attributes are own enumerable accessors and survive object spread', (t) => {
  const { location } = createWindow(t);
  for (const name of urlAttributes) {
    const descriptor = Object.getOwnPropertyDescriptor(location, name);
    assert.ok(descriptor, name);
    assert.equal(descriptor.enumerable, true, name);
    assert.equal(descriptor.configurable, false, name);
    assert.equal(typeof descriptor.get, 'function', name);
    assert.equal(typeof descriptor.set, name === 'origin' ? 'undefined' : 'function', name);
  }
  assert.deepEqual(snapshot({ ...location }), {
    href: 'https://example.test:8443/docs?view=1#start',
    origin: 'https://example.test:8443',
    protocol: 'https:',
    host: 'example.test:8443',
    hostname: 'example.test',
    port: '8443',
    pathname: '/docs',
    search: '?view=1',
    hash: '#start',
  });
  assert.equal(Reflect.deleteProperty(location, 'href'), false);
});

test('fresh Location spreads reflect history and hash changes without replacing Location', (t) => {
  const window = createWindow(t);
  const location = window.location;
  const before = { ...location };
  window.history.replaceState(null, '', '/updated?view=2#history');
  assert.strictEqual(window.location, location);
  assert.equal(before.href, 'https://example.test:8443/docs?view=1#start');
  assert.equal({ ...location }.href, 'https://example.test:8443/updated?view=2#history');
  assert.equal({ ...location }.pathname, '/updated');
  assert.equal({ ...location }.search, '?view=2');

  location.hash = '#setter';
  assert.equal({ ...location }.hash, '#setter');
  assert.equal({ ...location }.href, 'https://example.test:8443/updated?view=2#setter');
});

test('new windows and iframe Locations have independent enumerable URL attributes', (t) => {
  const window = createWindow(t, { settings: { enableIframePageLoading: true } });
  const other = createWindow(t, { url: 'https://other.test/' });
  const iframe = window.document.createElement('iframe');
  window.document.body.append(iframe);
  const childLocation = iframe.contentWindow.location;
  assert.equal({ ...childLocation }.href, 'about:blank');
  assert.equal({ ...other.location }.href, 'https://other.test/');
  assert.notStrictEqual(childLocation, window.location);
  assert.notStrictEqual(other.location, window.location);

  window.location.hash = '#parent';
  assert.equal({ ...childLocation }.href, 'about:blank');
  assert.equal({ ...other.location }.href, 'https://other.test/');
  assert.equal({ ...window.location }.hash, '#parent');
});
