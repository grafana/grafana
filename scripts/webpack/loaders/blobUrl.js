const loaderUtils = require('loader-utils');

module.exports = function blobUrl(source) {
  const { type } = loaderUtils.getOptions(this) || {};
  return `module.exports = URL.createObjectURL(new Blob([${JSON.stringify(source)}]${
    type ? `, { type: ${JSON.stringify(type)} }` : ''
  }));`;
};
