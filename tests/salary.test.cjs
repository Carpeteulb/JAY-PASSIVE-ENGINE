const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// Execute the actual browser script, without copying its calculation logic.
// This small DOM double covers only the API used by app.js; it is not a browser.
function loadApp() {
  const element = (extra = {}) => ({
    value: '', textContent: '', listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
    ...extra,
  });
  const elements = Object.fromEntries(
    ['annual-salary', 'salary-form', 'monthly-gross', 'monthly-deduction', 'monthly-net']
      .map(id => [id, element()])
  );
  const buttons = [...html.matchAll(/data-value="(\d+)"/g)]
    .map(match => element({ dataset: { value: match[1] } }));
  const context = {
    document: {
      querySelector(selector) {
        const found = elements[selector.slice(1)];
        assert.ok(found, 'Unexpected selector: ' + selector);
        return found;
      },
      querySelectorAll(selector) {
        assert.equal(selector, '[data-value]');
        return buttons;
      },
    },
  };
  runInNewContext(source, context, { filename: 'app.js' });
  return { ...context, elements, buttons };
}

function submit(app, value) {
  app.elements['annual-salary'].value = value;
  let prevented = false;
  app.elements['salary-form'].listeners.submit({
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
}

function expectAmounts(app, expected) {
  const ids = ['monthly-gross', 'monthly-deduction', 'monthly-net'];
  ids.forEach((id, index) => {
    assert.equal(app.elements[id].textContent, '₩' + expected[index].toLocaleString('ko-KR'), id);
  });
}

test('HTML retains the script and required calculation elements', () => {
  for (const id of ['annual-salary', 'salary-form', 'monthly-gross', 'monthly-deduction', 'monthly-net']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.match(html, /<script\s+src="app\.js"><\/script>/);
});

test('input parsing preserves the existing digits-only behavior', () => {
  const app = loadApp();
  for (const [input, expected] of [
    ['', 0], ['abc', 0], ['0', 0], ['55,000,000', 55000000],
    ['₩ 55,000,000원', 55000000], ['-123', 123], ['12.34', 1234],
  ]) {
    assert.equal(app.numericValue(input), expected, input);
  }
});

test('deduction bands include the exact boundary and change one won above it', () => {
  const app = loadApp();
  for (const [annual, expected] of [
    [0, .105], [29999999, .105], [30000000, .105], [30000001, .125],
    [49999999, .125], [50000000, .125], [50000001, .145],
    [69999999, .145], [70000000, .145], [70000001, .17],
    [99999999, .17], [100000000, .17], [100000001, .2],
  ]) {
    assert.equal(app.estimateDeductionRate(annual), expected, String(annual));
  }
});

test('submission renders fixed expected amounts, including rounding and every band', () => {
  const app = loadApp();
  // Expected amounts are fixed fixtures, not calculated with production functions.
  for (const [input, expected] of [
    ['', [0, 0, 0]], ['abc', [0, 0, 0]],
    ['6', [1, 0, 1]], ['18', [2, 0, 2]],
    ['30,000,000', [2500000, 262500, 2237500]],
    ['40,000,000', [3333333, 416667, 2916666]],
    ['55,000,000', [4583333, 664583, 3918750]],
    ['84,000,000', [7000000, 1190000, 5810000]],
    ['120,000,000', [10000000, 2000000, 8000000]],
  ]) {
    submit(app, input);
    expectAmounts(app, expected);
  }
});

test('input events add separators and clear empty/non-numeric input', () => {
  const app = loadApp();
  const input = app.elements['annual-salary'];
  for (const [value, expected] of [['55000000', '55,000,000'], ['abc', ''], ['', ''], ['0', '']]) {
    input.value = value;
    input.listeners.input({ target: input });
    assert.equal(input.value, expected);
  }
});

test('all four quick-value buttons update the input and calculate immediately', () => {
  const app = loadApp();
  assert.deepEqual(app.buttons.map(button => button.dataset.value),
    ['30000000', '40000000', '50000000', '70000000']);
  const fixtures = [
    [2500000, 262500, 2237500],
    [3333333, 416667, 2916666],
    [4166667, 520833, 3645834],
    [5833333, 845833, 4987500],
  ];
  app.buttons.forEach((button, index) => {
    button.listeners.click();
    assert.equal(app.elements['annual-salary'].value,
      Number(button.dataset.value).toLocaleString('ko-KR'));
    expectAmounts(app, fixtures[index]);
  });
});
