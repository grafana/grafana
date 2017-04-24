module.exports = function(config, grunt) {
  'use strict'
  return {
    tslint : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json --type-check",
    tslintfile : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json --type-check <%= tslint.source.files.src %>",
    tscompile: "node ./node_modules/typescript/lib/tsc.js -p tsconfig.json --diagnostics",
    tswatch: "node ./node_modules/typescript/lib/tsc.js -p tsconfig.json --diagnostics --watch",
  };
};
