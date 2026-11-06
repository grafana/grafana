// Run with node --test scripts/test-harness/environment/happy-dom-css.node.cjs, not Jest.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { before, test } = require('node:test');
const { pathToFileURL } = require('node:url');

const happyDOMRequire = createRequire(require.resolve('happy-dom/package.json'));
const load = (file) => import(pathToFileURL(happyDOMRequire.resolve(`./lib/${file}`)).href);
let Window;
let symbols;
let CSSComputedStyle;
let QuerySelector;
let SelectorParser;

before(async () => {
  [
    { Window },
    symbols,
    { default: CSSComputedStyle },
    { default: QuerySelector },
    { default: SelectorParser },
  ] = await Promise.all([
    load('index.js'),
    load('PropertySymbol.js'),
    load('css/declaration/computed-style/CSSComputedStyle.js'),
    load('query-selector/QuerySelector.js'),
    load('query-selector/SelectorParser.js'),
  ]);
  assert.equal(typeof SelectorParser.getSelectorGroups, 'function', 'shared selector-plan API must be installed');
});

function cssTest(name, run) {
  test(name, { concurrency: false, timeout: 5000 }, async () => {
    const window = new Window();
    try {
      await run(window, window.document);
    } finally {
      await window.happyDOM.close();
    }
  });
}

function addStyle(document, css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  return style;
}

function addElement(document, tag = 'div', parent = document.body) {
  const element = document.createElement(tag);
  parent.append(element);
  return element;
}

cssTest('cascade preserves specificity, source order, inline declarations, and important', (window, document) => {
  addStyle(document, `
    #selected { color: blue; }
    .target { color: green; background-color: red; }
    div { color: black; }
    .target { background-color: yellow; visibility: hidden !important; }
  `);
  const element = addElement(document);
  element.id = 'selected';
  element.className = 'target';
  element.style.cssText = 'visibility: visible;';
  const computed = window.getComputedStyle(element);
  assert.equal(computed.color, 'blue');
  assert.equal(computed.backgroundColor, 'yellow');
  assert.equal(computed.visibility, 'hidden');
  element.style.color = 'red';
  assert.equal(computed.color, 'red');
  element.style.setProperty('visibility', 'visible', 'important');
  assert.equal(computed.visibility, 'visible');
});

cssTest('cached ancestors preserve inherited properties and custom variables', (window, document) => {
  addStyle(document, '.parent { --tone: red; color: blue; } .child { background-color: var(--tone); }');
  const parent = addElement(document);
  parent.className = 'parent';
  const child = addElement(document, 'span', parent);
  child.className = 'child';
  assert.equal(window.getComputedStyle(parent).color, 'blue');
  const computed = window.getComputedStyle(child);
  assert.equal(computed.color, 'blue');
  assert.equal(computed.backgroundColor, 'red');
  parent.style.setProperty('--tone', 'green');
  parent.style.color = 'yellow';
  assert.equal(computed.color, 'yellow');
  assert.equal(computed.backgroundColor, 'green');
});

cssTest('inline attribute parsing caches its key and normalized cssText serialization', (window, document) => {
  const element = addElement(document);
  const style = element.style;
  const manager = () => style[symbols.getPropertyManager]();
  const empty = manager();
  assert.strictEqual(manager(), empty);
  element.setAttribute('style', 'color:red');
  const first = manager();
  assert.notStrictEqual(first, empty);
  assert.equal(style.color, 'red');
  assert.strictEqual(manager(), first);
  assert.equal(style[symbols.cache].attributeValue, 'color:red');

  style.cssText = 'color:blue;background-color: red';
  const serializedManager = style[symbols.cache].propertyManager;
  assert.equal(style[symbols.cache].attributeValue, element.getAttribute('style'));
  assert.notEqual(element.getAttribute('style'), 'color:blue;background-color: red');
  assert.strictEqual(manager(), serializedManager);
  assert.equal(style.color, 'blue');
  assert.strictEqual(manager(), serializedManager);

  style.setProperty('color', 'green');
  assert.strictEqual(manager(), serializedManager);
  assert.equal(window.getComputedStyle(element).color, 'green');
  style.removeProperty('color');
  assert.equal(style.color, '');
  assert.strictEqual(manager(), serializedManager);
  element.removeAttribute('style');
  const removed = manager();
  assert.notStrictEqual(removed, serializedManager);
  assert.equal(style.cssText, '');
  assert.strictEqual(manager(), removed);
  element.setAttribute('style', 'color: yellow');
  assert.equal(window.getComputedStyle(element).color, 'yellow');
});

cssTest('cssText caches the serialized attribute rather than the pre-serialization declarations', (window, document) => {
  const element = addElement(document);
  const style = element.style;
  style.cssText = 'border-color: blue; border: 1px solid red';
  assert.equal(element.getAttribute('style'), 'border: 1px solid red;');
  assert.equal(style.item(0), 'border-top-width');
  assert.equal(style.getPropertyValue('border-top-color'), 'red');

  // The existing serializer drops mixed shorthand priorities. Preserve readback of the stored attribute.
  style.cssText = 'margin: 1px 2px; margin-top: 3px !important';
  assert.equal(element.getAttribute('style'), 'margin: 3px 2px 1px;');
  const manager = style[symbols.getPropertyManager]();
  for (let i = 0; i < 2; i++) {
    assert.equal(style.marginTop, '3px');
    assert.equal(style.getPropertyPriority('margin-top'), '');
    assert.strictEqual(style[symbols.getPropertyManager](), manager);
  }
});

cssTest('computed cache hits bypass the helper and retain live invalidation', (window, document) => {
  const element = addElement(document);
  element.style.color = 'red';
  const computed = window.getComputedStyle(element);
  const manager = computed[symbols.getPropertyManager]();
  assert.strictEqual(window.getComputedStyle(element), computed);
  assert.strictEqual(new CSSComputedStyle(element).getComputedStyle(), manager);
  const original = CSSComputedStyle.prototype.getComputedStyle;
  CSSComputedStyle.prototype.getComputedStyle = () => {
    assert.fail('a computed property cache hit must not enter the helper');
  };
  try {
    assert.equal(computed.color, 'red');
    assert.strictEqual(computed[symbols.getPropertyManager](), manager);
  } finally {
    CSSComputedStyle.prototype.getComputedStyle = original;
  }
  element.style.color = 'blue';
  assert.equal(computed.color, 'blue');
  assert.notStrictEqual(computed[symbols.getPropertyManager](), manager);
  document[symbols.clearComputedStyleCache]();
  assert.equal(computed.color, 'blue');
});

cssTest('disconnected elements do not reuse connected computed styles', (window, document) => {
  const element = document.createElement('div');
  element.style.color = 'red';
  const computed = window.getComputedStyle(element);
  assert.equal(computed.color, '');
  document.body.append(element);
  assert.equal(computed.color, 'red');
  element.remove();
  assert.equal(computed.color, '');
  assert.equal(new CSSComputedStyle(element).getComputedStyle().size(), 0);
  document.body.append(element);
  assert.equal(computed.color, 'red');
});

cssTest('class, id, and replacement tag mutations rebuild ephemeral candidates', (window, document) => {
  addStyle(document, '.first { color: red; } .second { color: blue; } #selected { color: green; } span { color: yellow; }');
  const element = addElement(document);
  element.className = 'first';
  const computed = window.getComputedStyle(element);
  assert.equal(computed.color, 'red');
  element.className = 'second';
  assert.equal(computed.color, 'blue');
  element.id = 'selected';
  assert.equal(computed.color, 'green');
  element.id = '';
  assert.equal(computed.color, 'blue');
  element.className = '';
  const replacement = document.createElement('span');
  element.replaceWith(replacement);
  assert.equal(window.getComputedStyle(replacement).color, 'yellow');
});

cssTest('stylesheet text replacement and CSSOM edits do not retain rule plans or candidates', (window, document) => {
  const style = addStyle(document, '.first { color: red; }');
  const element = addElement(document);
  element.className = 'first';
  element.id = 'selected';
  const computed = window.getComputedStyle(element);
  assert.equal(computed.color, 'red');
  style.textContent = '#selected { color: blue; }';
  assert.equal(computed.color, 'blue');
  const sheet = style.sheet;
  sheet.deleteRule(0);
  sheet.insertRule('div { color: green; }');
  // CSSOM methods do not invalidate computed styles upstream; this test does not redesign that behavior.
  document[symbols.clearComputedStyleCache]();
  assert.equal(computed.color, 'green');
  sheet.cssRules[0][symbols.selectorText] = '.missing';
  document[symbols.clearComputedStyleCache]();
  assert.notEqual(computed.color, 'green');
  sheet.replaceSync('#selected { color: yellow; }');
  document[symbols.clearComputedStyleCache]();
  assert.equal(computed.color, 'yellow');
  const replacement = document.createElement('style');
  replacement.textContent = '#selected { color: purple; }';
  style.replaceWith(replacement);
  assert.equal(computed.color, 'purple');
});

cssTest('adopted stylesheet discovery reads the getter once and observes replacements', (window, document) => {
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync('.target { color: red; }');
  document.adoptedStyleSheets = [sheet];
  const element = addElement(document);
  element.className = 'target';
  const computed = window.getComputedStyle(element);
  assert.equal(computed.color, 'red');
  let reads = 0;
  const root = {
    querySelectorAll: () => [],
    get adoptedStyleSheets() {
      reads++;
      return [sheet];
    },
  };
  assert.deepEqual(new CSSComputedStyle(element).getStyleSheets(root), [sheet]);
  assert.equal(reads, 1);
  const replacement = new window.CSSStyleSheet();
  replacement.replaceSync('.target { color: blue; }');
  document.adoptedStyleSheets = [replacement];
  assert.equal(computed.color, 'blue');
});

cssTest('groups, escaped names, compound selectors, and combinators use the fallback', (window, document) => {
  addStyle(document, String.raw`
    .missing, .target { color: red; }
    .escaped\:name { background-color: blue; }
    #escaped\:id { visibility: hidden; }
    section > div.target[data-kind="item"] { display: inline; }
  `);
  const parent = addElement(document, 'section');
  const element = addElement(document, 'div', parent);
  element.className = 'target escaped:name';
  element.id = 'escaped:id';
  element.setAttribute('data-kind', 'item');
  const computed = window.getComputedStyle(element);
  assert.equal(computed.color, 'red');
  assert.equal(computed.backgroundColor, 'blue');
  assert.equal(computed.visibility, 'hidden');
  assert.equal(computed.display, 'inline');
});

cssTest('candidate filtering preserves trailing whitespace, Unicode names, and SVG tag matching', (window, document) => {
  const element = addElement(document);
  element.className = 'target café';
  element.id = 'selected';
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync('.target { color: red; }');
  const helper = new CSSComputedStyle(element);
  for (const selector of ['.target\n', '#selected\r', 'DIV\n', ' .target ', '.café']) {
    sheet.cssRules[0][symbols.selectorText] = selector;
    const entry = { element, cssTexts: [], propertyManager: null };
    helper.parseCSSRules({ elements: [entry], cssRules: sheet.cssRules });
    assert.equal(entry.cssTexts.length, 1, selector);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', 'target');
  svg.append(rect);
  document.body.append(svg);
  addStyle(document, 'rect { fill: red; } .target { visibility: hidden; }');
  assert.equal(window.getComputedStyle(rect).fill, 'red');
  assert.equal(window.getComputedStyle(rect).visibility, 'hidden');
});

cssTest('candidate indexing preserves rule/element order and shares one plan per rule', (window, document) => {
  const first = addElement(document);
  first.className = 'match match escaped:name';
  const second = addElement(document, 'span');
  second.className = 'match';
  second.id = 'selected';
  const third = addElement(document);
  const elements = [first, second, third];
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync(String.raw`
    .match { color: red; }
    #selected { color: blue; }
    DIV { color: green; }
    .missing { color: black; }
    .match { background-color: yellow; }
    .match, #selected { visibility: hidden; }
    .escaped\:name { display: inline; }
  `);
  const helper = new CSSComputedStyle(first);
  const entries = () => elements.map((element) => ({ element, cssTexts: [], propertyManager: null }));
  const indexed = entries();
  const calls = [];
  const plans = [];
  let builds = 0;
  const originalIndex = helper.getCandidateIndex;
  const originalMatch = QuerySelector.matches;
  const originalPlan = SelectorParser.getSelectorGroups;
  helper.getCandidateIndex = function (items) {
    builds++;
    return originalIndex.call(this, items);
  };
  QuerySelector.matches = function (element, selector, options) {
    calls.push({ element, selector, options, groups: options.selectorGroups });
    return originalMatch.call(this, element, selector, options);
  };
  SelectorParser.getSelectorGroups = function (selector, options) {
    plans.push(selector);
    return originalPlan.call(this, selector, options);
  };
  try {
    helper.parseCSSRules({ elements: indexed, cssRules: sheet.cssRules });
  } finally {
    QuerySelector.matches = originalMatch;
    SelectorParser.getSelectorGroups = originalPlan;
    helper.getCandidateIndex = originalIndex;
  }
  assert.equal(builds, 1);
  assert.deepEqual(calls.map(({ selector, element }) => [selector, elements.indexOf(element)]), [
    ['.match', 0], ['.match', 1], ['#selected', 1], ['DIV', 0], ['DIV', 2],
    ['.match', 0], ['.match', 1],
    ['.match, #selected', 0], ['.match, #selected', 1], ['.match, #selected', 2],
    ['.escaped\\:name', 0], ['.escaped\\:name', 1], ['.escaped\\:name', 2],
  ]);
  assert.deepEqual(plans, ['.match', '#selected', 'DIV', '.match', '.match, #selected', '.escaped\\:name']);
  assert.ok(calls.every((call) => call.options === calls[0].options && Array.isArray(call.groups)));
  assert.strictEqual(calls[0].groups, calls[1].groups);
  const unindexed = entries();
  helper.getCandidateIndex = () => null;
  helper.parseCSSRules({ elements: unindexed, cssRules: sheet.cssRules });
  assert.deepEqual(indexed.map((entry) => entry.cssTexts), unindexed.map((entry) => entry.cssTexts));
});

cssTest('shadow hosts, fragments, and shadow descendants keep full matching', (window, document) => {
  const host = addElement(document, 'section');
  host.className = 'host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host { color: red; } .inside { background-color: blue; }';
  const child = document.createElement('span');
  child.className = 'inside';
  shadow.append(style, child);
  assert.equal(window.getComputedStyle(host).color, 'red');
  assert.equal(window.getComputedStyle(child).backgroundColor, 'blue');
  const helper = new CSSComputedStyle(child);
  for (const element of [host, shadow, child]) {
    assert.equal(helper.getCandidateIndex([{ element, cssTexts: [], propertyManager: null }]), null);
  }
  const sheet = new window.CSSStyleSheet();
  sheet.replaceSync('.host { color: green; } section { visibility: hidden; }');
  const entry = { element: shadow, cssTexts: [], propertyManager: null };
  helper.parseCSSRules({ elements: [entry], cssRules: sheet.cssRules });
  assert.equal(entry.cssTexts.length, 2, 'fragment selectors must still match through the host');
  style.textContent = ':host { color: green; } .inside { background-color: yellow; }';
  assert.equal(window.getComputedStyle(host).color, 'green');
  assert.equal(window.getComputedStyle(child).backgroundColor, 'yellow');
});

cssTest('@scope preserves warm ancestor discovery, scope selectors, and end boundaries', (window, document) => {
  addStyle(document, `
    .target { color: black; }
    @scope (.scope) to (.stop) {
      .target { color: red; }
      :scope > .target { background-color: blue; }
    }
  `);
  const parent = addElement(document, 'section');
  parent.className = 'scope';
  const child = addElement(document, 'div', parent);
  child.className = 'target';
  const stop = addElement(document, 'section', parent);
  stop.className = 'stop';
  const outside = addElement(document, 'div', stop);
  outside.className = 'target';
  window.getComputedStyle(parent).getPropertyValue('color');
  const computed = window.getComputedStyle(child);
  assert.equal(computed.color, 'red');
  assert.equal(computed.backgroundColor, 'blue');
  assert.equal(window.getComputedStyle(outside).color, 'black');
  parent.className = '';
  assert.equal(computed.color, 'black');
  parent.className = 'scope';
  assert.equal(computed.color, 'red');
});
