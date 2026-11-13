const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { before, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const happyDOMRequire = createRequire(require.resolve('happy-dom/package.json'));
let Window;

before(async () => {
  ({ Window } = await import(pathToFileURL(happyDOMRequire.resolve('./lib/index.js')).href));
});

function fixture(t, initiallySelected) {
  const window = new Window();
  t.after(() => window.happyDOM.close());
  const { document } = window;
  document.body.innerHTML = `
    <main id="ancestor" class="${initiallySelected ? 'selected' : ''}">
      <section class="branch">
        <div>
          <div><div><span id="line" class="line">text</span></div></div>
        </div>
      </section>
    </main>`;
  return {
    window,
    ancestor: document.getElementById('ancestor'),
    scope: document.body,
    line: document.getElementById('line'),
  };
}

for (const initiallySelected of [false, true]) {
  const firstState = initiallySelected ? 'selected' : 'unselected';

  test(
    `computed background follows distant ancestor class changes after the first read is ${firstState}`,
    { timeout: 5000 },
    (t) => {
      const { window, ancestor, line } = fixture(t, initiallySelected);
      const style = window.document.createElement('style');
      style.textContent = '.line { background-color: red; } .selected .line { background-color: transparent; }';
      window.document.head.append(style);
      const computed = window.getComputedStyle(line);

      for (const selected of [initiallySelected, !initiallySelected, initiallySelected]) {
        ancestor.className = selected ? 'selected' : '';
        const expected = selected ? 'transparent' : 'red';
        assert.equal(computed.backgroundColor, expected);
        assert.equal(window.getComputedStyle(line).backgroundColor, expected);
      }
    }
  );

  for (const selector of ['.selected .line', '.selected > .branch .line']) {
    for (const api of ['matches', 'querySelector', 'querySelectorAll']) {
      test(
        `${api} invalidates ${selector} after distant ancestor class changes from ${firstState}`,
        { timeout: 5000 },
        (t) => {
          const { ancestor, scope, line } = fixture(t, initiallySelected);
          const read = () => {
            if (api === 'matches') {
              return line.matches(selector);
            }
            if (api === 'querySelector') {
              return scope.querySelector(selector)?.id ?? null;
            }
            return Array.from(scope.querySelectorAll(selector), (element) => element.id);
          };

          for (const selected of [initiallySelected, !initiallySelected, initiallySelected]) {
            ancestor.className = selected ? 'selected' : '';
            const expected = {
              matches: selected,
              querySelector: selected ? 'line' : null,
              querySelectorAll: selected ? ['line'] : [],
            }[api];
            assert.deepEqual(read(), expected);
            assert.deepEqual(read(), expected);
          }
        }
      );
    }
  }
}
