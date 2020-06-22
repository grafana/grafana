'use strict';

const pkg = require('../../package.json');
const pull = require('lodash/pull');

let dependencies = Object.keys(pkg.dependencies);
// remove jquery so we can add it first
// remove rxjs so we can only depend on parts of it in code
pull(dependencies, 'jquery', 'rxjs');

// add jquery first
dependencies.unshift('jquery');

module.exports = dependencies;
