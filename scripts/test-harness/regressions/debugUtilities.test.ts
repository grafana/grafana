import { store } from '@grafana/data';
import { attachDebugger as uiAttachDebugger, createLogger as uiCreateLogger } from '@grafana/ui';
import { attachDebugger, createLogger } from '@grafana/ui/debug';

import { attachDebugger as legacyAttachDebugger } from '../../../packages/grafana-ui/src/utils/debug';
import { createLogger as legacyCreateLogger } from '../../../packages/grafana-ui/src/utils/logger';

const debugWindow = window as Window & { _debug?: Record<string, object> };
let originalDebug: typeof debugWindow._debug;
let originalDebugSetting: string | undefined;
let log: jest.SpyInstance;

beforeEach(() => {
  originalDebug = debugWindow._debug;
  originalDebugSetting = store.get('grafana.debug');
  debugWindow._debug = {};
  store.delete('grafana.debug');
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'development' });
  jest.useFakeTimers();
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (originalDebug === undefined) {
    delete debugWindow._debug;
  } else {
    debugWindow._debug = originalDebug;
  }
  if (originalDebugSetting === undefined) {
    store.delete('grafana.debug');
  } else {
    store.set('grafana.debug', originalDebugSetting);
  }
});

it('keeps the UI debug entry point, public exports, and legacy paths on the same implementations', () => {
  expect(uiCreateLogger).toBe(createLogger);
  expect(legacyCreateLogger).toBe(createLogger);
  expect(uiAttachDebugger).toBe(attachDebugger);
  expect(legacyAttachDebugger).toBe(attachDebugger);
});

it('reads the debug setting at creation and preserves per-logger enable/disable controls and log arguments', () => {
  const disabled = createLogger('disabled');
  expect(disabled.isEnabled()).toBe(false);
  disabled.logger('hidden');
  expect(log).not.toHaveBeenCalled();

  store.set('grafana.debug', 'true');
  const enabled = createLogger('enabled');
  store.set('grafana.debug', 'false');
  expect(enabled.isEnabled()).toBe(true);
  expect(createLogger('later').isEnabled()).toBe(false);
  expect(disabled.isEnabled()).toBe(false);

  const payload = { path: '/dashboard' };
  enabled.logger('navigate', false, payload, 42);
  expect(log.mock.calls).toEqual([['[enabled: navigate]:', payload, 42]]);
  expect(log.mock.calls[0][1]).toBe(payload);
  expect(enabled.disable()).toBe(false);
  expect(enabled.isEnabled()).toBe(false);
  enabled.logger('hidden');
  expect(disabled.enable()).toBe(true);
  expect(disabled.isEnabled()).toBe(true);
  disabled.logger('visible');
  expect(log.mock.calls).toEqual([['[enabled: navigate]:', payload, 42], ['[disabled: visible]:']]);
});

it.each(['production', 'test'])(
  'suppresses enabled loggers in %s without scheduling a throttled log',
  (environment) => {
    const logger = createLogger('environment');
    logger.enable();
    process.env.NODE_ENV = environment;
    logger.logger('hidden', false, 'direct');
    logger.logger('hidden', true, 'throttled');
    jest.advanceTimersByTime(500);
    expect(log).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    process.env.NODE_ENV = 'development';
    logger.logger('visible', false, 'development');
    expect(log.mock.calls).toEqual([['[environment: visible]:', 'development']]);
  }
);

it('shares one leading/trailing 500ms throttle across logger instances and all import paths', () => {
  const debug = createLogger('debug');
  const ui = uiCreateLogger('ui');
  const legacy = legacyCreateLogger('legacy');
  debug.enable();
  ui.enable();
  legacy.enable();

  debug.logger('first', true, 1);
  ui.logger('superseded', true, 2);
  legacy.logger('last', true, 3);
  expect(log.mock.calls).toEqual([['[debug: first]:', 1]]);
  jest.advanceTimersByTime(499);
  expect(log.mock.calls).toEqual([['[debug: first]:', 1]]);
  jest.advanceTimersByTime(1);
  expect(log.mock.calls).toEqual([
    ['[debug: first]:', 1],
    ['[legacy: last]:', 3],
  ]);
  jest.advanceTimersByTime(500);
  ui.logger('next', true, 4);
  expect(log.mock.calls).toEqual([
    ['[debug: first]:', 1],
    ['[legacy: last]:', 3],
    ['[ui: next]:', 4],
  ]);
});

it('attaches helpers by reference without a logger and preserves other debugger keys', () => {
  delete debugWindow._debug;
  const helpers = { inspect: () => 'state' };
  attachDebugger('first', helpers);
  legacyAttachDebugger('empty');
  expect(debugWindow._debug?.first).toBe(helpers);
  expect(debugWindow._debug?.empty).toEqual({});
});

it('combines helpers with controls for the supplied logger without mutating the helpers', () => {
  const logger = createLogger('debugger');
  const helpers = { inspect: () => 'state', enable: () => 'original' };
  uiAttachDebugger('controls', helpers, logger);
  const controls = debugWindow._debug?.controls as {
    inspect: () => string;
    enable: () => boolean;
    disable: () => boolean;
  };
  expect(controls.inspect()).toBe('state');
  expect(logger.isEnabled()).toBe(false);
  expect(controls.enable()).toBe(true);
  expect(logger.isEnabled()).toBe(true);
  logger.logger('visible');
  expect(log.mock.calls).toEqual([['[debugger: visible]:']]);
  expect(controls.disable()).toBe(false);
  expect(logger.isEnabled()).toBe(false);
  expect(helpers.enable()).toBe('original');
});

it('leaves the debugger registry unchanged in production but attaches in test', () => {
  const existing = { inspect: () => 'existing' };
  const replacement = { inspect: () => 'replacement' };
  attachDebugger('existing', existing);
  const registry = debugWindow._debug;
  process.env.NODE_ENV = 'production';
  attachDebugger('existing', replacement);
  attachDebugger('new', replacement);
  expect(debugWindow._debug).toBe(registry);
  expect(debugWindow._debug).toEqual({ existing });

  process.env.NODE_ENV = 'test';
  attachDebugger('existing', replacement);
  expect(debugWindow._debug?.existing).toBe(replacement);
});
