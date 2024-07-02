const { parse } = require('ini');
const { readFileSync, existsSync } = require('node:fs');

const getEnvConfig = () => {
  const defaultSettings = readFileSync(`./conf/defaults.ini`, {
    encoding: 'utf-8',
  });

  const customSettings = existsSync(`./conf/custom.ini`)
    ? readFileSync(`./conf/custom.ini`, {
        encoding: 'utf-8',
      })
    : '';

  const defaults = parse(defaultSettings);
  const custom = parse(customSettings);

  const merged = { ...defaults.frontend_dev, ...custom.frontend_dev };
  // Take all frontend keys from the ini file and prefix with `frontend_dev_`,
  // so they can be added to `process.env` elsewhere
  return Object.entries(merged).reduce((acc, [key, value]) => {
    return {
      ...acc,
      [`frontend_dev_${key}`]: value,
    };
  }, {});
};

module.exports = getEnvConfig;
