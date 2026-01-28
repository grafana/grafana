const loader = require('../interactive-element-id-loader');
const assert = require('assert');

const mockContext = {
  getOptions: () => ({}),
  resourcePath: '/Users/robbymilo/grafana/grafana/public/app/features/dashboard/components/DashboardGrid.tsx',
  rootContext: '/Users/robbymilo/grafana/grafana',
};

console.log('Running interactive-element-id-loader tests...');

(function testAddUniqueId() {
  const source = `
    import React from 'react';
    export const MyComponent = () => {
      return (
        <div>
          <button onClick={() => {}}>Click Me</button>
        </div>
      );
    };
  `;

  const result = loader.call(mockContext, source);
  // Expect format: Scope:Component:Name
  // mock path: /Users/robbymilo/grafana/grafana/public/app/features/dashboard/components/DashboardGrid.tsx
  // Scope: dashboard
  // Component: dashboard-grid
  // Name: click-me
  assert.ok(
    result.includes('data-unique-id="dashboard:dashboard-grid:click-me"'),
    'Should add scoped human readable id'
  );
})();

(function testUseAriaLabel() {
  const source1 = `
    import React from 'react';
    export const MyComponent = () => {
      return <button aria-label="save item">Save</button>;
    };
  `;
  const result1 = loader.call(mockContext, source1);
  // aria-label: "save-item", innerText: "save"
  assert.ok(
    result1.includes('data-unique-id="dashboard:dashboard-grid:save-item:save"'),
    'Result should use aria-label and text'
  );
})();

(function testDataTestId() {
  const source = `
    import React from 'react';
    export const MyComponent = () => {
      return <button data-testid="my-test-id">Button</button>;
    };
  `;
  const result = loader.call(mockContext, source);
  // data-testid: "my-test-id", innerText: "button"
  assert.ok(
    result.includes('data-unique-id="dashboard:dashboard-grid:my-test-id:button"'),
    'Result should use data-testid'
  );
})();

(function testHref() {
  const source = `
    import React from 'react';
    export const MyLink = () => {
      return <a href="/home/dashboard">Go Home</a>;
    };
  `;
  const result = loader.call(mockContext, source);
  // href: "/home/dashboard" -> "home-dashboard", innerText: "go-home"
  assert.ok(
    result.includes('data-unique-id="dashboard:dashboard-grid:home-dashboard:go-home"'),
    'Result should use href'
  );
})();

(function testCombinedAttributes() {
  const source = `
    import React from 'react';
    export const MyComponent = () => {
      return <button data-testid="tid" aria-label="lbl" label="custom">Text</button>;
    };
  `;
  const result = loader.call(mockContext, source);
  // testid: tid, aria-label: lbl, label: custom, text: Text
  assert.ok(
    result.includes('data-unique-id="dashboard:dashboard-grid:tid:lbl:custom:text"'),
    'Result should combine attributes'
  );
})();

(function testDynamicId() {
  const source = `
     import React from 'react';
     export const MyInput = ({ dynamicId }) => {
       return <input id={dynamicId} />;
     };
   `;
  const result = loader.call(mockContext, source);
  // Fallback tag name: input
  // Should produce: data-unique-id={"dashboard:dashboard-grid:input-" + dynamicId}
  assert.ok(
    result.includes('data-unique-id={"dashboard:dashboard-grid:input-" + dynamicId}'),
    'Result should use dynamic id'
  );
})();

(function testDeduplication() {
  const source = `
    import React from 'react';
    export const MyComponent = () => {
      return (
        <div>
          <button onClick={() => {}}>Save</button>
          <button onClick={() => {}}>Save</button>
        </div>
      );
    };
  `;
  const result = loader.call(mockContext, source);
  assert.ok(result.includes('data-unique-id="dashboard:dashboard-grid:save"'));
  assert.ok(result.includes('data-unique-id="dashboard:dashboard-grid:save-1"'));
})();

(function testCleanText() {
  // Regression test for "button-angle-down" issue (attributes being picked up)
  const source = `
     import React from 'react';
     export const MyComponent = () => {
       return (
         <button>
            <span className="fa fa-angle-down"></span>
            Click Me
         </button>
       );
     };
   `;
  const result = loader.call(mockContext, source);
  // Should NOT be "click-me-fa-fa-angle-down"
  assert.ok(
    result.includes('data-unique-id="dashboard:dashboard-grid:click-me"'),
    'Should capture only text content, ignoring attributes'
  );
})();

(function testNestedComponent() {
  // Regression test for JSXMemberExpression (e.g. Menu.Item)
  const source = `
     import React from 'react';
     export const MyComponent = () => {
       return (
         <Menu.Item onClick={() => {}}>
            Settings
         </Menu.Item>
       );
     };
   `;
  const result = loader.call(mockContext, source);
  assert.ok(
    result.includes('data-unique-id="dashboard:dashboard-grid:settings"'),
    'Should handle nested component names'
  );
})();

(function testSkipNonInteractive() {
  const source = `
    import React from 'react';
    export const MyComponent = () => {
      return <div><span>Hello</span></div>;
    };
  `;

  const result = loader.call(mockContext, source);
  assert.ok(!result.includes('data-unique-id'), 'Should not add id to non-interactive elements');
  console.log('✓ testSkipNonInteractive passed');
})();

(function testDynamicAttribute() {
  // Test dynamic aria-label handling
  const source = `
     import React from 'react';
     export const MyComponent = ({ label }) => {
       return <button aria-label={label}>Click</button>;
     };
   `;
  const result = loader.call(mockContext, source);
  // Should produce: data-unique-id={"dashboard:dashboard-grid" + ":" + "click" + ":" + (label || "")}
  // Order: prefix + ":" + text + ":" + dynamic
  // And click is static

  // Actually, current order is mixed: parts are iterated.
  // aria-label comes first in array.
  // segments: [ { type: 'dynamic', node: label }, { type: 'static', value: 'click' } ]

  assert.ok(
    result.includes('data-unique-id={"dashboard:dashboard-grid" + ":" + (label || "") + ":" + "click"}'),
    'Result should use dynamic aria-label'
  );
})();

console.log('All tests passed!');
