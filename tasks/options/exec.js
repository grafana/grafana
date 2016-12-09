module.exports = function(config) {
  'use strict'
  return {
    tslint : "node ./node_modules/tslint/lib/tslint-cli.js -c tslint.json --project ./tsconfig.json --type-check",
    tscompile: "node ./node_modules/typescript/lib/tsc.js -p tsconfig.json" 
  };
};
