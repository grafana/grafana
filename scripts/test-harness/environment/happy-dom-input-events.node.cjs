const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let Window;
before(async () => {
  ({ Window } = await import('happy-dom'));
});

function setup(t) {
  const window = new Window();
  t.after(() => window.happyDOM.close());
  const input = window.document.createElement('input');
  input.type = 'number';
  window.document.body.append(input);
  return { window, input };
}

test('number inputs preserve valid finite HTML floating-point strings without normalizing them', (t) => {
  const { input } = setup(t);
  for (const [value, number] of [
    ['0', 0],
    ['-0', -0],
    ['00', 0],
    ['-10', -10],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['-.5', -0.5],
    ['01.50', 1.5],
    ['1e2', 100],
    ['1E+2', 100],
    ['-1e-2', -0.01],
    ['.5e1', 5],
    ['1.7976931348623157e308', 1.7976931348623157e308],
    ['5e-324', 5e-324],
    ['1e-324', 0],
  ]) {
    input.value = value;
    assert.equal(input.value, value);
    assert.equal(input.valueAsNumber, number, value);
  }
});

test('number inputs clear invalid syntax instead of accepting numeric prefixes', (t) => {
  const { input } = setup(t);
  for (const value of [
    '1asd',
    '',
    '+1',
    '-',
    '+',
    '.',
    '-.',
    '1.',
    '1.e2',
    '1e',
    '1e+',
    '1e-',
    'e1',
    '--1',
    '1.2.3',
    '1e2x',
    '0x10',
    '0b10',
    '0o10',
    '1_000',
    '1,000',
    '１２',
  ]) {
    input.value = '15';
    input.value = value;
    assert.equal(input.value, '', JSON.stringify(value));
    assert.equal(input.valueAsNumber, NaN, JSON.stringify(value));
  }
});

test('number inputs reject leading, embedded and trailing whitespace including final line terminators', (t) => {
  const { input } = setup(t);
  for (const value of [' 1', '1 ', '\t1', '1\t', '\n1', '1\n', '1\r', '1\r\n', '1\u2028', '1\u2029', '1 2', '1\ne2']) {
    input.value = '15';
    input.value = value;
    assert.equal(input.value, '', JSON.stringify(value));
  }
});

test('number inputs clear non-finite values and overflowing exponents', (t) => {
  const { input } = setup(t);
  for (const value of ['Infinity', '-Infinity', '+Infinity', 'NaN', '1e309', '-1e309', '1.7976931348623159e308']) {
    input.value = '15';
    input.value = value;
    assert.equal(input.value, '', value);
    assert.equal(input.valueAsNumber, NaN, value);
  }
});

test('number sanitization does not clamp valid values to min, max or step', (t) => {
  const { input } = setup(t);
  input.min = '1';
  input.max = '10';
  input.step = '2';
  for (const value of ['-10', '100', '1.5']) {
    input.value = value;
    assert.equal(input.value, value);
  }
});

test('KeyboardEvent charCode defaults to zero for omitted, null and empty initialization', (t) => {
  const { window } = setup(t);
  for (const type of ['keydown', 'keypress', 'keyup']) {
    assert.equal(new window.KeyboardEvent(type).charCode, 0);
    assert.equal(new window.KeyboardEvent(type, null).charCode, 0);
    assert.equal(new window.KeyboardEvent(type, {}).charCode, 0);
    assert.equal(new window.KeyboardEvent(type, { key: 'Enter', keyCode: 13 }).charCode, 0);
  }
});

test('dispatching an Enter keypress preserves charCode without requiring keyCode or focus', (t) => {
  const { window, input } = setup(t);
  const received = [];
  window.document.addEventListener('keypress', (event) => {
    received.push(event);
  });
  input.dispatchEvent(
    new window.KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
      bubbles: true,
    })
  );
  assert.equal(received.length, 1);
  const [event] = received;
  assert.equal(event.target, input);
  assert.deepEqual([event.key, event.code, event.charCode, event.keyCode, event.which], ['Enter', 'Enter', 13, 0, 0]);
});

test('KeyboardEvent preserves explicit charCode independently of keyCode and which', (t) => {
  const { window } = setup(t);
  for (const charCode of [0, 13, 32, 65]) {
    const event = new window.KeyboardEvent('keypress', { charCode, keyCode: 40, which: 41 });
    assert.equal(event.charCode, charCode);
    assert.equal(event.keyCode, 40);
    assert.equal(event.which, 41);
  }
});
