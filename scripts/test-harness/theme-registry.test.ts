import { getBuiltInThemes, getThemeById } from '../../packages/grafana-data/src/themes/registry';

describe('theme registry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates extras on first use and reuses the validated definitions', async () => {
    await jest.isolateModulesAsync(async () => {
      const { NewThemeOptionsSchema } = await import('../../packages/grafana-data/src/themes/createTheme');
      const parse = jest.spyOn(NewThemeOptionsSchema, 'safeParse');
      const { getBuiltInThemes, getThemeById } = await import('../../packages/grafana-data/src/themes/registry');

      expect(parse).not.toHaveBeenCalled();

      const themes = getBuiltInThemes(['debug', 'aubergine', 'debug', 'unknown-theme']);
      expect(themes.map(({ id }) => id)).toEqual(['dark', 'light', 'system', 'aubergine', 'debug']);
      expect(parse).toHaveBeenCalledTimes(18);

      const aubergine = themes[3];
      expect(aubergine).toMatchObject({ id: 'aubergine', name: 'Aubergine', isExtra: true });
      expect(aubergine.build()).toMatchObject({
        name: 'Aubergine',
        isDark: true,
        colors: { background: { canvas: '#2E1F2D' } },
      });
      expect(getThemeById('debug')).toMatchObject({
        name: 'Debug',
        colors: { background: { canvas: '#000033' } },
      });
      expect(getBuiltInThemes([]).map(({ id }) => id)).toEqual(['dark', 'light', 'system']);
      expect(getBuiltInThemes(['aubergine'])[3]).toBe(aubergine);
      expect(parse).toHaveBeenCalledTimes(18);
    });
  });

  it.each([
    ['dark', 'Dark', true],
    ['light', 'Light', false],
    ['unknown-theme', 'Dark', true],
  ])('builds %s as %s', (id, name, isDark) => {
    expect(getThemeById(id)).toMatchObject({ name, isDark, isLight: !isDark });
  });

  it('builds a fresh theme on each lookup without changing the cached definition', () => {
    const first = getThemeById('aubergine');
    first.flags.visualDesignRefresh = true;
    first.colors.primary.main = '#123456';

    const second = getThemeById('aubergine');
    expect(second).not.toBe(first);
    expect(second.flags).toEqual({});
    expect(second.colors.primary.main).toBe('#8C5A69');
  });

  it('reads the current system preference on every build', () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const matchMedia = jest.spyOn(window, 'matchMedia').mockReturnValue({ ...mediaQuery, matches: true });

    expect(getThemeById('system')).toMatchObject({ name: 'Dark', isDark: true });

    matchMedia.mockReturnValue({ ...mediaQuery, matches: false });
    expect(getThemeById('system')).toMatchObject({ name: 'Light', isLight: true });
    expect(matchMedia).toHaveBeenCalledTimes(2);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('logs and skips an invalid definition once, without affecting a fresh module instance', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      const { default: definition } = await import(
        '../../packages/grafana-data/src/themes/themeDefinitions/debug.json'
      );
      const originalMode = definition.colors.mode;
      definition.colors.mode = 'sepia';

      try {
        const { getBuiltInThemes, getThemeById } = await import('../../packages/grafana-data/src/themes/registry');
        expect(error).not.toHaveBeenCalled();

        expect(getThemeById('debug')).toMatchObject({ name: 'Dark', isDark: true });
        expect(getBuiltInThemes(['debug', 'aubergine']).map(({ id }) => id)).toEqual([
          'dark',
          'light',
          'system',
          'aubergine',
        ]);
        expect(getThemeById('debug').name).toBe('Dark');
        expect(error).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining('Invalid theme definition for theme debug:'));
        expect(error.mock.calls[0][0]).toContain('"mode"');
      } finally {
        definition.colors.mode = originalMode;
      }
    });

    await jest.isolateModulesAsync(async () => {
      const { getBuiltInThemes, getThemeById } = await import('../../packages/grafana-data/src/themes/registry');
      expect(getBuiltInThemes(['debug']).map(({ id }) => id)).toEqual(['dark', 'light', 'system', 'debug']);
      expect(getThemeById('debug')).toMatchObject({
        name: 'Debug',
        colors: { background: { canvas: '#000033' } },
      });
      expect(error).toHaveBeenCalledTimes(1);
    });
  });
});
