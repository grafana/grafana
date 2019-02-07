const sass = require('node-sass');
const getThemeVariable = require('./getThemeVariable');
const { mockTheme } = require('@grafana/ui');

const themeMock = {
  color: {
    background: '#ff0000',
  },
  spacing: {
    padding: '2em',
  },
  typography: {
    fontFamily: 'Arial, sans-serif',
  },
};

describe('Variables retrieval', () => {
  const restoreTheme = mockTheme(() => themeMock);

  afterAll(() => {
    restoreTheme();
  });

  it('returns sass Color for color values', () => {
    const result = getThemeVariable({ getValue: () => 'color.background' }, { getValue: () => {} });
    expect(result).toBeInstanceOf(sass.types.Color);
  });
  it('returns sass Number for dimension values', () => {
    const result = getThemeVariable({ getValue: () => 'spacing.padding' }, { getValue: () => {} });
    expect(result).toBeInstanceOf(sass.types.Number);
  });
  it('returns sass String for string values', () => {
    const result = getThemeVariable({ getValue: () => 'typography.fontFamily' }, { getValue: () => {} });
    expect(result).toBeInstanceOf(sass.types.String);
  });

  it('throws for unknown theme paths', () => {
    expect(() => getThemeVariable({ getValue: () => 'what.ever' }, { getValue: () => {} })).toThrow();
  });
});
