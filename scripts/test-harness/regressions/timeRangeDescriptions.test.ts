import { addResourceBundle, changeLanguage, getI18nInstance, initializeI18n } from '@grafana/i18n/internal';

import { dateTime } from '../../../packages/grafana-data/src/datetime/moment_wrapper';
import { describeTextRange, describeTimeRange } from '../../../packages/grafana-data/src/datetime/rangeutil';

// Exercise collection-time callers too, rather than moving their work into a test hook.
const beforeTests = {
  range: describeTimeRange({ from: 'now', to: 'now+5y' }),
  text: describeTextRange('now/fQ'),
};

const standardRanges = [
  ['now/d', 'now/d', 'Today'],
  ['now/d', 'now', 'Today so far'],
  ['now/w', 'now/w', 'This week'],
  ['now/w', 'now', 'This week so far'],
  ['now/M', 'now/M', 'This month'],
  ['now/M', 'now', 'This month so far'],
  ['now/y', 'now/y', 'This year'],
  ['now/y', 'now', 'This year so far'],
  ['now-1d/d', 'now-1d/d', 'Yesterday'],
  ['now-2d/d', 'now-2d/d', 'Day before yesterday'],
  ['now-7d/d', 'now-7d/d', 'This day last week'],
  ['now-1w/w', 'now-1w/w', 'Previous week'],
  ['now-1M/M', 'now-1M/M', 'Previous month'],
  ['now-1Q/fQ', 'now-1Q/fQ', 'Previous fiscal quarter'],
  ['now-1y/y', 'now-1y/y', 'Previous year'],
  ['now-1y/fy', 'now-1y/fy', 'Previous fiscal year'],
  ['now-5m', 'now', 'Last 5 minutes'],
  ['now-15m', 'now', 'Last 15 minutes'],
  ['now-30m', 'now', 'Last 30 minutes'],
  ['now-1h', 'now', 'Last 1 hour'],
  ['now-3h', 'now', 'Last 3 hours'],
  ['now-6h', 'now', 'Last 6 hours'],
  ['now-12h', 'now', 'Last 12 hours'],
  ['now-24h', 'now', 'Last 24 hours'],
  ['now-2d', 'now', 'Last 2 days'],
  ['now-7d', 'now', 'Last 7 days'],
  ['now-30d', 'now', 'Last 30 days'],
  ['now-90d', 'now', 'Last 90 days'],
  ['now-6M', 'now', 'Last 6 months'],
  ['now-1y', 'now', 'Last 1 year'],
  ['now-2y', 'now', 'Last 2 years'],
  ['now-5y', 'now', 'Last 5 years'],
  ['now/fQ', 'now', 'This fiscal quarter so far'],
  ['now/fQ', 'now/fQ', 'This fiscal quarter'],
  ['now/fy', 'now', 'This fiscal year so far'],
  ['now/fy', 'now/fy', 'This fiscal year'],
  ['now', 'now+1m', 'Next 1 minute'],
  ['now', 'now+5m', 'Next 5 minutes'],
  ['now', 'now+15m', 'Next 15 minutes'],
  ['now', 'now+30m', 'Next 30 minutes'],
  ['now', 'now+1h', 'Next 1 hour'],
  ['now', 'now+3h', 'Next 3 hours'],
  ['now', 'now+6h', 'Next 6 hours'],
  ['now', 'now+12h', 'Next 12 hours'],
  ['now', 'now+24h', 'Next 24 hours'],
  ['now', 'now+2d', 'Next 2 days'],
  ['now', 'now+7d', 'Next 7 days'],
  ['now', 'now+30d', 'Next 30 days'],
  ['now', 'now+90d', 'Next 90 days'],
  ['now', 'now+6M', 'Next 6 months'],
  ['now', 'now+1y', 'Next 1 year'],
  ['now', 'now+2y', 'Next 2 years'],
  ['now', 'now+5y', 'Next 5 years'],
];

beforeAll(async () => {
  await initializeI18n({ language: 'en-US', ns: ['translation'] });
});

afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  getI18nInstance().removeResourceBundle('fr-FR', 'translation');
  await changeLanguage('en-US');
});

it('supports collection-time descriptions', () => {
  expect(beforeTests.range).toBe('Next 5 years');
  expect(beforeTests.text).toStrictEqual({ from: 'now/fQ', to: 'now', display: 'This fiscal quarter so far' });
});

it.each(standardRanges)('translates only the matching preset from %s to %s', (from, to, display) => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTimeRange({ from, to })).toBe(display);
  expect(translate).toHaveBeenCalledTimes(1);
});

it.each([
  ['5m', 'now-5m', 'Last 5 minutes'],
  ['now-1h', 'now-1h', 'Last 1 hour'],
  ['now/d', 'now/d', 'Today so far'],
  ['now/fQ', 'now/fQ', 'This fiscal quarter so far'],
  ['now/fy', 'now/fy', 'This fiscal year so far'],
])('translates only the matching text preset for %s', (expr, from, display) => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTextRange(expr)).toStrictEqual({ from, to: 'now', display });
  expect(translate).toHaveBeenCalledTimes(1);
});

it('honors the first custom match, including an empty or changed label, without translating presets', () => {
  const translate = jest.spyOn(getI18nInstance(), 't');
  const range = { from: 'now-5m', to: 'now' };
  const quickRanges = [
    { from: 'now-5m', to: 'now-1m', display: 'Only the start matches' },
    { ...range, display: '', section: 2 },
    { ...range, display: 'Later duplicate' },
  ];

  expect(describeTimeRange(range, undefined, quickRanges)).toBe('');
  quickRanges[1].display = 'First custom label';
  expect(describeTimeRange(range, undefined, quickRanges)).toBe('First custom label');
  expect(describeTimeRange({ from: 'now-5m', to: 'now-1m' }, undefined, quickRanges)).toBe('Only the start matches');
  expect(translate).not.toHaveBeenCalled();
});

it.each([
  { name: 'empty custom ranges', quickRanges: [] },
  {
    name: 'a custom range with only one matching endpoint',
    quickRanges: [{ from: 'now-5m', to: 'now-1m', display: 'Not this range' }],
  },
])('falls through $name to one translated preset', ({ quickRanges }) => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTimeRange({ from: 'now-5m', to: 'now' }, undefined, quickRanges)).toBe('Last 5 minutes');
  expect(translate).toHaveBeenCalledTimes(1);
});

it('returns independent mutable text options without exposing the stored definitions', () => {
  const first = describeTextRange('5m');
  const second = describeTextRange('5m');
  expect(first).not.toBe(second);

  Object.assign(first, { from: 'changed', to: 'changed', display: 'Changed', section: 3, invalid: true });
  expect(first.display).toBe('Changed');
  expect(second).toStrictEqual({ from: 'now-5m', to: 'now', display: 'Last 5 minutes' });
  expect(describeTextRange('5m')).toStrictEqual({ from: 'now-5m', to: 'now', display: 'Last 5 minutes' });
  expect(describeTimeRange({ from: 'now-5m', to: 'now' })).toBe('Last 5 minutes');
});

it('reads the current locale for each call, while earlier returned strings remain unchanged', async () => {
  const englishText = describeTextRange('1h');
  expect(describeTimeRange({ from: 'now/d', to: 'now/d' })).toBe('Today');

  addResourceBundle('fr-FR', 'translation', {
    'grafana-data': {
      datetime: {
        rangeutils: {
          getBaseRangeOptions: { today: "Aujourd'hui", todaySoFar: "Aujourd'hui jusqu'à présent" },
          lastNHours_one: 'Dernière {{count}} heure',
          lastNHours_other: 'Dernières {{count}} heures',
          nextNMinutes_one: 'Prochaine {{count}} minute',
          nextNMinutes_other: 'Prochaines {{count}} minutes',
        },
      },
    },
  });
  await changeLanguage('fr-FR');
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTimeRange({ from: 'now/d', to: 'now/d' })).toBe("Aujourd'hui");
  expect(describeTextRange('now/d')).toStrictEqual({
    from: 'now/d',
    to: 'now',
    display: "Aujourd'hui jusqu'à présent",
  });
  const frenchText = describeTextRange('1h');
  expect(frenchText).toStrictEqual({ from: 'now-1h', to: 'now', display: 'Dernière 1 heure' });
  expect(describeTimeRange({ from: 'now-3h', to: 'now' })).toBe('Dernières 3 heures');
  expect(describeTimeRange({ from: 'now', to: 'now+1m' })).toBe('Prochaine 1 minute');
  expect(describeTimeRange({ from: 'now', to: 'now+5m' })).toBe('Prochaines 5 minutes');
  expect(describeTextRange('+5m')).toStrictEqual({
    from: 'now',
    to: 'now+5m',
    display: 'Next 5 minutes',
    section: undefined,
  });
  expect(describeTimeRange({ from: 'now-13h', to: 'now' })).toBe('Last 13 hours');
  expect(translate).toHaveBeenCalledTimes(6);

  expect(englishText).toStrictEqual({ from: 'now-1h', to: 'now', display: 'Last 1 hour' });

  await changeLanguage('en-US');
  expect(describeTimeRange({ from: 'now/d', to: 'now/d' })).toBe('Today');
  expect(describeTextRange('1h')).toStrictEqual({ from: 'now-1h', to: 'now', display: 'Last 1 hour' });
  expect(frenchText).toStrictEqual({ from: 'now-1h', to: 'now', display: 'Dernière 1 heure' });
});

it.each([
  ['13h', 'now-13h', 'now', 'Last 13 hours'],
  ['0m', 'now-0m', 'now', 'Last 0 minute'],
  ['+1m', 'now', 'now+1m', 'Next 1 minute'],
  ['+5m', 'now', 'now+5m', 'Next 5 minutes'],
  ['now+5m', 'now+5m', 'now', 'Last 5 minutes'],
  ['1fQ/fQ', 'now-1fQ/fQ', 'now', 'Last 1 fiscal quarter'],
  ['2fy', 'now-2fy', 'now', 'Last 2 fiscal years'],
  ['2Q', 'now-2Q', 'now', 'Last 2 quarters'],
])('preserves the text fallback for %s without translating presets', (expr, from, to, display) => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTextRange(expr)).toStrictEqual({ from, to, display, section: undefined });
  expect(translate).not.toHaveBeenCalled();
});

it.each([
  ['not-a-range', 'now-not-a-range', 'now-not-a-range to now'],
  ['now/d+6h', 'now/d+6h', 'now/d+6h to now'],
  ['now-1x', 'now-1x', 'now-1x to now'],
  ['2h to now/d', '2h to now/d', '2h to now/d to now'],
])('preserves invalid text metadata for %s without translating presets', (expr, from, display) => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTextRange(expr)).toStrictEqual({ from, to: 'now', display, invalid: true });
  expect(translate).not.toHaveBeenCalled();
});

it.each([
  ['now-13h', 'now', 'Last 13 hours'],
  ['now-1fQ/fQ', 'now', 'Last 1 fiscal quarter'],
  ['now-6h', 'now-3h', 'now-6h to now-3h'],
  ['now', 'now+13h', 'now to now+13h'],
  ['now/d+6h', 'now', 'now/d+6h to now'],
])('preserves the unmatched range from %s to %s without translating presets', (from, to, display) => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTimeRange({ from, to })).toBe(display);
  expect(translate).not.toHaveBeenCalled();
});

it('still normalizes a shorthand start when the range ends at now', () => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  expect(describeTimeRange({ from: '5m', to: 'now' })).toBe('Last 5 minutes');
  expect(translate).toHaveBeenCalledTimes(1);
});

it('formats absolute and mixed ranges without translating unused preset labels', () => {
  jest.useFakeTimers({ now: new Date('2023-01-15T12:00:00Z') });
  const translate = jest.spyOn(getI18nInstance(), 't');
  const from = dateTime('2023-01-15T10:30:00Z');
  const to = dateTime('2023-01-15T14:45:00Z');

  expect(describeTimeRange({ from, to }, 'utc')).toBe('2023-01-15 10:30:00 to 2023-01-15 14:45:00');
  expect(describeTimeRange({ from, to }, 'Australia/Sydney')).toBe('2023-01-15 21:30:00 to 2023-01-16 01:45:00');
  expect(describeTimeRange({ from: 'now-1h', to }, 'utc')).toBe('1 hour ago to 2023-01-15 14:45:00');
  expect(describeTimeRange({ from, to: 'now+1d' }, 'utc')).toBe('2023-01-15 10:30:00 to in 1 day');
  expect(describeTimeRange({ from, to: 'now-invalid' }, 'utc')).toBe('');
  expect(describeTimeRange({ from: 'now-invalid', to }, 'utc')).toBe('');
  expect(translate).not.toHaveBeenCalled();

  expect(describeTimeRange({ from, to: 'now' }, 'utc')).toBe('2023-01-15 10:30:00 to a few seconds ago');
  expect(describeTimeRange({ from: 'now+5s', to }, 'utc')).toBe('in a few seconds to 2023-01-15 14:45:00');
  expect(translate.mock.calls.map(([key]) => key)).toEqual([
    'grafana-data.datetime.rangeutils.fewSecondsPast',
    'grafana-data.datetime.rangeutils.fewSecondsFuture',
  ]);
});
