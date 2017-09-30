module.exports = function(config, grunt) {
  'use strict'
  return {
    tslint : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json --type-check",
    tslintfile : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json --type-check <%= tslint.source.files.src %>",
    "webpack-prod": "./node_modules/.bin/webpack --optimize-minimize --config scripts/webpack/webpack.prod.js",
    "webpack-dev": "./node_modules/.bin/webpack --config scripts/webpack/webpack.dev.js",
  };
};
