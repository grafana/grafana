module.exports = function(config) {
  'use strict'
  return {
    tslint : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json <%= tslint.source.files.src %>",
    tscompile: "node ./node_modules/typescript/lib/tsc.js -p tsconfig.json --diagnostics",
    tswatch: "node ./node_modules/typescript/lib/tsc.js -p tsconfig.json --diagnostics --watch",
  };
};
