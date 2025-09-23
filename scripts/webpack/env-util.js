// @ts-check
const { parse } = require('ini');
const { readFileSync, existsSync } = require('node:fs');
const path = require('path');

const getEnvConfig = () => {
  const grafanaRoot = path.join(__dirname, '../..');
  const defaultSettings = readFileSync(`${grafanaRoot}/conf/defaults.ini`, {
    encoding: 'utf-8',
  });

  const customSettings = existsSync(`${grafanaRoot}/conf/custom.ini`)
    ? readFileSync(`${grafanaRoot}/conf/custom.ini`, {
        encoding: 'utf-8',
      })
    : '';

  const defaults = parse(defaultSettings);
  const custom = parse(customSettings);

  const merged = { ...defaults.frontend_dev, ...custom.frontend_dev };

  // Take all frontend keys from the ini file and prefix with `frontend_dev_`,
  // so they can be added to `process.env` elsewhere
  /** @type {Record<string, unknown>} */
  const env = {};

  for (const [key, value] of Object.entries(merged)) {
    env[`frontend_dev_${key}`] = value;
  }

  return env;
};

module.exports = getEnvConfig;
