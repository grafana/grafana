import { parse } from 'ini';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const getEnvConfig = (): Record<string, unknown> => {
  const grafanaRoot = path.join(import.meta.dirname, '../..');
  const defaultSettings = readFileSync(`${grafanaRoot}/conf/defaults.ini`, { encoding: 'utf-8' });

  const customSettings = existsSync(`${grafanaRoot}/conf/custom.ini`)
    ? readFileSync(`${grafanaRoot}/conf/custom.ini`, { encoding: 'utf-8' })
    : '';

  const defaults = parse(defaultSettings);
  const custom = parse(customSettings);

  const merged = { ...defaults.frontend_dev, ...custom.frontend_dev };

  // Take all frontend keys from the ini file and prefix with `frontend_dev_`,
  // so they can be added to `process.env` elsewhere
  const env: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(merged)) {
    env[`frontend_dev_${key}`] = value;
  }

  return env;
};

export default getEnvConfig;
