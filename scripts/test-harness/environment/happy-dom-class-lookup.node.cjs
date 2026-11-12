const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let Window;
before(async () => {
  ({ Window } = await import('happy-dom'));
});

for (const rootType of ['Document', 'Element']) {
  function setup(t) {
    const window = new Window();
    t.after(() => window.happyDOM.close());
    const { document } = window;
    const container = document.createElement('div');
    document.body.append(container);
    return { window, document, container, root: rootType === 'Document' ? document : container };
  }

  for (const className of ['', ' ', '\t', '\n', '\f', '\r', ' \t\n\f\r ']) {
    test(`${rootType}.getElementsByClassName(${JSON.stringify(className)}) stays empty after mutations`, (t) => {
      const { window, document, container, root } = setup(t);
      const collection = root.getElementsByClassName(className);
      assert.ok(collection instanceof window.HTMLCollection);
      const assertEmpty = () => {
        assert.equal(collection.length, 0);
        assert.equal(collection[0], undefined);
        assert.equal(collection.item(0), null);
        assert.equal(collection.namedItem('child'), null);
        assert.deepEqual(Array.from(collection), []);
      };
      assertEmpty();
      const child = document.createElement('span');
      child.id = 'child';
      child.className = className;
      container.append(child);
      assertEmpty();
      child.className = 'trace selected';
      assertEmpty();
      child.remove();
      assertEmpty();
    });
  }

  test(`${rootType} nonempty class lookups retain live single- and multiple-class matching`, (t) => {
    const { document, container, root } = setup(t);
    const single = root.getElementsByClassName('trace');
    const multiple = root.getElementsByClassName('trace selected');
    assert.deepEqual(Array.from(single), []);
    assert.deepEqual(Array.from(multiple), []);
    const child = document.createElement('span');
    child.id = 'child';
    child.className = 'trace selected';
    container.append(child);
    assert.deepEqual(Array.from(single), [child]);
    assert.deepEqual(Array.from(multiple), [child]);
    assert.strictEqual(single[0], child);
    assert.strictEqual(single.item(0), child);
    assert.strictEqual(single.namedItem('child'), child);
    child.className = 'trace';
    assert.deepEqual(Array.from(single), [child]);
    assert.deepEqual(Array.from(multiple), []);
    child.remove();
    assert.deepEqual(Array.from(single), []);
  });

  test(`${rootType}.querySelectorAll('.') still rejects an invalid CSS selector`, (t) => {
    const { root } = setup(t);
    assert.throws(() => root.querySelectorAll('.'), /'\.' is not a valid selector/);
  });
}
