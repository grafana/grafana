const dev = require('../../scripts/webpack/webpack.dev.js');
const prod = require('../../scripts/webpack/webpack.prod.js');


module.exports = function() {
  'use strict';
  return {
    options: {
      stats: true,
    },
    dev: dev,
    prod: prod
  };
};
