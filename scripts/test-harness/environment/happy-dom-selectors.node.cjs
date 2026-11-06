const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { before, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const happyDOMRequire = createRequire(require.resolve('happy-dom/package.json'));
const load = (file) => import(pathToFileURL(happyDOMRequire.resolve(`./lib/${file}`)).href);

let Window;
let QuerySelector;
let SelectorParser;
let PropertySymbol;

before(async () => {
  [{ Window }, { default: QuerySelector }, { default: SelectorParser }, PropertySymbol] = await Promise.all([
    load('index.js'),
    load('query-selector/QuerySelector.js'),
    load('query-selector/SelectorParser.js'),
    load('PropertySymbol.js'),
  ]);
});

function createWindow(t) {
  const window = new Window({ url: 'https://selectors.test/' });
  t.after(() => window.happyDOM.close());
  return window;
}

function parserOptions(window, scope = window.document.documentElement, ignoreErrors = false) {
  return { window, scope, ignoreErrors, globalMatchFunction: QuerySelector.globalMatchFunction };
}

function fixture(window) {
  window.document.body.innerHTML = `
    <section id="root" class="root">
      <article id="branch" class="branch">
        <i id="lead" class="lead"></i>
        <span id="first" class="leaf hot"></span>
        <b id="gap"></b>
        <span id="last" class="leaf tail"></span>
      </article>
      <span id="direct" class="leaf"></span>
    </section>`;
  return window.document.getElementById('root');
}

function freezePlan(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return;
  }
  if (Array.isArray(value)) {
    // Reject copies as well as mutations: traversal must use the cached arrays directly.
    for (const method of ['slice', 'reverse']) {
      Object.defineProperty(value, method, {
        value() {
          throw new Error(`Selector traversal called ${method}`);
        },
      });
    }
  }
  for (const child of Object.values(value)) {
    freezePlan(child);
  }
  Object.freeze(value);
}

for (const [selector, ids] of [
  ['.root .leaf', ['first', 'last', 'direct']],
  ['.root > .branch > .leaf', ['first', 'last']],
  ['.lead + .leaf', ['first']],
  ['.lead ~ .tail', ['last']],
  ['.root > .branch .lead + .leaf', ['first']],
  ['.root > .leaf', ['direct']],
  ['.missing .leaf', []],
]) {
  test(`matches and queries traverse frozen plans for ${selector}`, (t) => {
    const window = createWindow(t);
    const root = fixture(window);
    const groups = SelectorParser.getSelectorGroups(selector, parserOptions(window));
    freezePlan(groups);
    assert.deepEqual(Array.from(window.document.querySelectorAll(selector), (element) => element.id), ids);
    assert.equal(window.document.querySelector(selector)?.id ?? null, ids[0] ?? null);
    for (const element of root.querySelectorAll('*')) {
      assert.equal(element.matches(selector), ids.includes(element.id), element.id);
    }
    assert.strictEqual(SelectorParser.getSelectorGroups(selector, parserOptions(window)), groups);
  });
}

test('general-sibling matching checks multiple candidates without copying the plan', (t) => {
  const window = createWindow(t);
  fixture(window);
  const selector = '.lead ~ .leaf';
  freezePlan(SelectorParser.getSelectorGroups(selector, parserOptions(window)));
  for (const id of ['first', 'last']) {
    assert.deepEqual(QuerySelector.matches(window.document.getElementById(id), selector), { priorityWeight: 20 });
  }
  assert.equal(window.document.getElementById('direct').matches(selector), false);
});

test('descendant backtracking retains the selector index and accumulated specificity', (t) => {
  const window = createWindow(t);
  window.document.body.innerHTML = '<main class="root"><div class="branch"><div><div class="branch"><span class="leaf hot"></span></div></div></div></main>';
  const element = window.document.querySelector('span');
  const selector = '.root > .branch .leaf.hot';
  const groups = SelectorParser.getSelectorGroups(selector, parserOptions(window));
  freezePlan(groups);
  assert.deepEqual(QuerySelector.matches(element, selector, { selectorGroups: groups }), { priorityWeight: 40 });
  assert.strictEqual(window.document.querySelector(selector), element);
  assert.deepEqual(Array.from(window.document.querySelectorAll(selector)), [element]);
});

test('selector lists preserve document order, deduplication and first matching group weight', (t) => {
  const window = createWindow(t);
  fixture(window);
  const selector = '#last, .leaf, #first';
  freezePlan(SelectorParser.getSelectorGroups(selector, parserOptions(window)));
  assert.deepEqual(Array.from(window.document.querySelectorAll(selector), (element) => element.id), ['first', 'last', 'direct']);
  assert.equal(window.document.querySelector(selector).id, 'first');
  assert.deepEqual(QuerySelector.matches(window.document.getElementById('last'), selector), { priorityWeight: 100 });
  assert.deepEqual(QuerySelector.matches(window.document.getElementById('first'), selector), { priorityWeight: 10 });
});

test('static and instance parser APIs share plans without reparsing, but isolate windows and callbacks', (t) => {
  const window = createWindow(t);
  const otherWindow = createWindow(t);
  const options = parserOptions(window);
  const selector = '.root > .leaf:not(.off)';
  const groups = SelectorParser.getSelectorGroups(selector, options);
  const parse = t.mock.method(SelectorParser.prototype, 'getSelectorGroupsUncached');
  assert.strictEqual(SelectorParser.getSelectorGroups(` ${selector} `, options), groups);
  assert.strictEqual(new SelectorParser(options).getSelectorGroups(selector), groups);
  assert.equal(parse.mock.callCount(), 0);
  assert.notStrictEqual(SelectorParser.getSelectorGroups(selector, parserOptions(otherWindow)), groups);
  const callback = () => null;
  const otherGroups = SelectorParser.getSelectorGroups(selector, { ...options, globalMatchFunction: callback });
  assert.notStrictEqual(otherGroups, groups);
  assert.strictEqual(otherGroups[0][0].globalMatchFunction, callback);
});

test('pre-parsed matches bypass parser lookup and accept zero-specificity success', (t) => {
  const window = createWindow(t);
  const element = window.document.createElement('div');
  element.className = 'leaf';
  const options = parserOptions(window, element, true);
  const selector = ':where(.leaf)';
  const selectorGroups = SelectorParser.getSelectorGroups(selector, options);
  freezePlan(selectorGroups);
  t.mock.method(SelectorParser, 'getSelectorGroups', () => {
    throw new Error('A supplied plan must not be parsed or looked up again');
  });
  assert.deepEqual(QuerySelector.matches(element, selector, { ...options, selectorGroups }), { priorityWeight: 0 });
  element.className = 'other';
  assert.equal(QuerySelector.matches(element, selector, { ...options, selectorGroups }), null);
});

test('single-class rejection creates no match-cache or dependency records', (t) => {
  const window = createWindow(t);
  const element = window.document.createElement('div');
  window.document.body.append(element);
  const dependencies = window.document[PropertySymbol.affectsCache].length;
  assert.equal(element.matches('.absent'), false);
  assert.equal(element[PropertySymbol.cache].matches.size, 0);
  assert.equal(window.document[PropertySymbol.affectsCache].length, dependencies);
  assert.equal(element[PropertySymbol.classList], null);
  element.className = 'absent-extra other';
  assert.equal(element.matches('.absent'), false);
  assert.equal(element[PropertySymbol.cache].matches.size, 0);
  assert.equal(window.document[PropertySymbol.affectsCache].length, dependencies);
  element.classList.add('absent');
  assert.deepEqual(QuerySelector.matches(element, '.absent'), { priorityWeight: 10 });
  assert.equal(element[PropertySymbol.cache].matches.has('.absent'), true);
  element.classList.remove('absent');
  assert.equal(element.matches('.absent'), false);
  assert.equal(element[PropertySymbol.cache].matches.size, 0);
});

test('rejection does not skip alternatives, descendants or pseudo validation', (t) => {
  const window = createWindow(t);
  const root = window.document.createElement('div');
  root.innerHTML = '<span class="present"></span>';
  window.document.body.append(root);
  assert.equal(root.firstElementChild.matches('.absent, .present'), true);
  assert.strictEqual(root.querySelector('.present'), root.firstElementChild);
  assert.deepEqual(Array.from(root.querySelectorAll('.present')), [root.firstElementChild]);
  for (let i = 0; i < 2; i++) {
    assert.throws(() => root.matches('.absent['), window.DOMException);
    assert.throws(() => root.firstElementChild.matches('.present:not'), window.DOMException);
  }
  assert.equal(root[PropertySymbol.cache].matches.has('.absent['), false);
  assert.equal(root.firstElementChild[PropertySymbol.cache].matches.has('.present:not'), false);
});

test('class matching uses one internal token lookup for escaped and repeated classes', (t) => {
  const window = createWindow(t);
  const element = window.document.createElement('div');
  element.className = 'alpha\tbeta\nalpha\ffoo:bar\rfoo.bar';
  const classList = element.classList;
  t.mock.method(classList, 'contains', () => {
    throw new Error('Selector matching must not call public contains');
  });
  const getTokens = t.mock.method(classList, PropertySymbol.getTokenList);
  assert.deepEqual(QuerySelector.matches(element, '.alpha.beta.alpha.foo\\:bar.foo\\.bar'), { priorityWeight: 50 });
  assert.equal(getTokens.mock.callCount(), 1);
  const tokens = classList[PropertySymbol.cache].items;
  assert.deepEqual(QuerySelector.matches(element, '.beta.alpha'), { priorityWeight: 20 });
  assert.strictEqual(classList[PropertySymbol.cache].items, tokens);
  assert.deepEqual(QuerySelector.matches(element, '.beta'), { priorityWeight: 10 });
  assert.equal(getTokens.mock.callCount(), 3);
  assert.equal(element.matches('.Alpha'), false);
  assert.equal(element.matches('.alp'), false);
  element.setAttribute('class', 'beta');
  assert.equal(element.matches('.alpha.beta'), false);
  element.getAttributeNode('class').value = 'alpha beta';
  // Attr.value does not invalidate DOM results in this version; verify the token cache directly.
  const item = SelectorParser.getSelectorGroups('.alpha.beta', parserOptions(window))[0][0];
  assert.deepEqual(item.matchClass(element), { priorityWeight: 20 });
  element.removeAttribute('class');
  assert.equal(element.matches('.alpha.beta'), false);
  element.classList.value = 'alpha beta';
  assert.equal(element.matches('.alpha.beta'), true);
});

test('pseudos retain nested plans, specificity and zero-weight matches', (t) => {
  const window = createWindow(t);
  fixture(window);
  const first = window.document.getElementById('first');
  const branch = window.document.getElementById('branch');
  for (const [element, selector, weight] of [
    [first, ':where(.leaf)', 0],
    [first, ':is(.leaf, #first)', 100],
    [first, '.leaf:not(.off)', 20],
    [first, ':nth-child(2)', 10],
    [first, ':nth-child(1 of .leaf)', 10],
    [branch, ':has(> .leaf)', 10],
    [first, '[id="first"].leaf', 20],
  ]) {
    freezePlan(SelectorParser.getSelectorGroups(selector, parserOptions(window)));
    assert.deepEqual(QuerySelector.matches(element, selector), { priorityWeight: weight }, selector);
  }
  assert.equal(first.matches('.leaf::before'), false);
  assert.equal(first.matches(':not(.leaf)'), false);
});

test('scope is supplied at execution time and result-cache hits cannot cross scopes', (t) => {
  const window = createWindow(t);
  const root = fixture(window);
  const child = window.document.getElementById('direct');
  const selectorGroups = SelectorParser.getSelectorGroups(':scope', parserOptions(window, root));
  freezePlan(selectorGroups);
  assert.deepEqual(QuerySelector.matches(root, ':scope', { scope: root, selectorGroups }), { priorityWeight: 10 });
  assert.equal(QuerySelector.matches(root, ':scope', { scope: child, selectorGroups }), null);
  assert.ok(root[PropertySymbol.cache].matches.get(':scope').scope instanceof WeakRef);
  assert.strictEqual(root[PropertySymbol.cache].matches.get(':scope').scope.deref(), child);
  assert.deepEqual(QuerySelector.matches(root, ':scope', { scope: root, selectorGroups }), { priorityWeight: 10 });
  assert.equal(root[PropertySymbol.cache].matches.get(':scope').scope, null);
  assert.equal(child.matches(':scope'), true);
  assert.deepEqual(QuerySelector.matches(window.document.documentElement, ':scope', { scope: window.document }), { priorityWeight: 10 });
  assert.deepEqual(Array.from(root.querySelectorAll(':scope > .leaf')), [child]);
  assert.strictEqual(root.querySelector(':scope > .leaf'), child);
});

test('an empty document scope does not throw or reuse results after its root changes', (t) => {
  const window = createWindow(t);
  const document = window.document.implementation.createHTMLDocument();
  const root = document.documentElement;
  root.className = 'target';
  root.remove();
  for (let i = 0; i < 2; i++) {
    assert.equal(QuerySelector.matches(root, ':scope', { scope: document }), null);
    assert.deepEqual(QuerySelector.matches(root, '.target', { scope: document }), { priorityWeight: 10 });
  }
  assert.equal(root.matches(':scope'), true);
  assert.equal(QuerySelector.matches(root, ':scope', { scope: document }), null);
  document.append(root);
  assert.deepEqual(QuerySelector.matches(root, ':scope', { scope: document }), { priorityWeight: 10 });
  root.remove();
  assert.equal(QuerySelector.matches(root, ':scope', { scope: document }), null);
});

test('shadow matching resolves class selectors through the host and retains host invalidation', (t) => {
  const window = createWindow(t);
  const host = window.document.createElement('div');
  host.className = 'host';
  window.document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span class="leaf"></span>';
  const child = shadow.firstElementChild;
  const selectorGroups = SelectorParser.getSelectorGroups('.host > .leaf', parserOptions(window, shadow));
  freezePlan(selectorGroups);
  assert.deepEqual(QuerySelector.matches(child, '.host > .leaf', { scope: shadow, selectorGroups }), { priorityWeight: 20 });
  assert.strictEqual(shadow.querySelector('.host > .leaf'), child);
  assert.deepEqual(Array.from(shadow.querySelectorAll('.host > .leaf')), [child]);
  assert.deepEqual(QuerySelector.matches(shadow, '.host'), { priorityWeight: 10 });
  assert.equal(QuerySelector.matches(shadow, '.absent'), null);
  assert.equal(shadow[PropertySymbol.cache].matches.has('.absent'), false);
  assert.equal(host.matches(':host(.host)'), true);
  host.className = 'other';
  assert.equal(QuerySelector.matches(shadow, '.host'), null);
  assert.equal(QuerySelector.matches(child, '.host > .leaf', { scope: shadow, selectorGroups }), null);
  assert.equal(shadow.querySelector('.host > .leaf'), null);
  assert.deepEqual(Array.from(shadow.querySelectorAll('.host > .leaf')), []);
  assert.equal(QuerySelector.matches(window.document.createDocumentFragment(), '.host'), null);
});

test('class and tree mutations invalidate results without invalidating parsed plans', (t) => {
  const window = createWindow(t);
  const root = fixture(window);
  const first = window.document.getElementById('first');
  const lead = window.document.getElementById('lead');
  const branch = window.document.getElementById('branch');
  const selector = '.lead + .leaf';
  const groups = SelectorParser.getSelectorGroups(selector, parserOptions(window));
  assert.equal(first.matches(selector), true);
  const oldResult = first[PropertySymbol.cache].matches.get(selector);
  lead.className = 'off';
  assert.equal(oldResult.result, null);
  assert.equal(first.matches(selector), false);
  lead.className = 'lead';
  assert.equal(first.matches(selector), true);
  branch.insertBefore(first, lead);
  assert.equal(first.matches(selector), false);
  branch.insertBefore(first, lead.nextElementSibling);
  assert.equal(first.matches(selector), true);
  const list = root.querySelectorAll('.leaf');
  assert.deepEqual(Array.from(list, (element) => element.id), ['first', 'last', 'direct']);
  first.remove();
  assert.equal(first.matches('.root .leaf'), false);
  assert.deepEqual(Array.from(root.querySelectorAll('.leaf'), (element) => element.id), ['last', 'direct']);
  assert.deepEqual(Array.from(list, (element) => element.id), ['first', 'last', 'direct']);
  assert.strictEqual(SelectorParser.getSelectorGroups(selector, parserOptions(window)), groups);
});

test('focus, checked and target mutations retain dynamic pseudo invalidation', (t) => {
  const window = createWindow(t);
  const input = window.document.createElement('input');
  input.type = 'checkbox';
  input.id = 'target';
  window.document.body.append(input);
  assert.equal(input.matches(':checked'), false);
  input.checked = true;
  assert.equal(input.matches(':checked'), true);
  input.checked = false;
  assert.equal(input.matches(':checked'), false);
  assert.equal(input.matches(':focus'), false);
  input.focus();
  assert.equal(input.matches(':focus'), true);
  input.blur();
  assert.equal(input.matches(':focus'), false);
  assert.equal(input.matches(':target'), false);
  window.location.hash = '#target';
  assert.equal(input.matches(':target'), true);
  window.location.hash = '#other';
  assert.equal(input.matches(':target'), false);
});

test('ignored parser errors cannot poison strict plans or result caches', (t) => {
  const window = createWindow(t);
  const element = window.document.createElement('div');
  window.document.body.append(element);
  for (const selector of ['.missing[', ':not(.missing[)', ':not']) {
    assert.equal(QuerySelector.matches(element, selector, { ignoreErrors: true }), null);
    for (let i = 0; i < 2; i++) {
      assert.throws(() => element.matches(selector), window.DOMException, selector);
      assert.throws(() => element.querySelector(selector), window.DOMException, selector);
      assert.throws(() => element.querySelectorAll(selector), window.DOMException, selector);
    }
  }
  const options = parserOptions(window);
  assert.deepEqual(SelectorParser.getSelectorGroups('.missing[', { ...options, ignoreErrors: true }), []);
  assert.throws(() => SelectorParser.getSelectorGroups('.missing[', options), window.DOMException);
});

test('public validation and string conversion still precede the single-class fast path', (t) => {
  const window = createWindow(t);
  const element = window.document.createElement('div');
  element.className = 'present';
  assert.equal(element.matches({ toString: () => '.present' }), true);
  for (const selector of ['', '.1bad', '.', () => '.present']) {
    assert.throws(() => element.matches(selector), window.DOMException);
    assert.equal(QuerySelector.matches(element, selector, { ignoreErrors: true }), null);
  }
  assert.throws(() => element.matches(Symbol('selector')), window.TypeError);
  assert.equal(QuerySelector.matches(element, Symbol('selector'), { ignoreErrors: true }), null);
});
