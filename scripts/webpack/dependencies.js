'use strict';

const { pull } = require('lodash');

const pkg = require('../../package.json');

let dependencies = Object.keys(pkg.dependencies);
// remove jquery so we can add it first
// remove rxjs so we can only depend on parts of it in code
pull(dependencies, 'jquery', 'rxjs');

// add jquery first
dependencies.unshift('jquery');

module.exports = dependencies;
