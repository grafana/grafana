const mockFiles = [
  'packages/grafana-schema/src/schema/dashboard/v2/types.spec.gen.ts',
  'packages/grafana-schema/src/schema/notebook/v2beta1/types.spec.gen.ts',
  'public/app/example.test.ts',
  'public/app/example.spec.tsx',
  'public/app/example.ts',
];

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => JSON.stringify({ '@grafana/example': mockFiles })),
}));
jest.mock('../../jest.config.js', () => ({}));
jest.mock('open', () => ({ default: jest.fn() }));

test('codeowner coverage selects tests without treating generated schemas as test suites', () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const previousCodeowner = process.env.CODEOWNER_NAME;
  process.env.CODEOWNER_NAME = '@grafana/example';
  try {
    const config = require('../../jest.config.codeowner.js');
    expect(config.testMatch).toEqual(['<rootDir>/public/app/example.test.ts', '<rootDir>/public/app/example.spec.tsx']);
  } finally {
    if (previousCodeowner === undefined) {
      delete process.env.CODEOWNER_NAME;
    } else {
      process.env.CODEOWNER_NAME = previousCodeowner;
    }
  }
});
