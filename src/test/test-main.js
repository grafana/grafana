require.config({
  baseUrl: 'http://localhost:9876/base/src/app',

  paths: {
    specs:                 '../test/specs',
    mocks:                 '../test/mocks',
    config:                '../config.sample',
    kbn:                   'components/kbn',
    store:                 'components/store',

    settings:              'components/settings',
    lodash:                'components/lodash.extended',
    'lodash-src':          '../vendor/lodash',

    moment:                '../vendor/moment',
    chromath:              '../vendor/chromath',
    filesaver:             '../vendor/filesaver',

    angular:               '../vendor/angular/angular',
    'angular-route':       '../vendor/angular/angular-route',
    angularMocks:          '../vendor/angular/angular-mocks',
    'angular-dragdrop':       '../vendor/angular/angular-dragdrop',
    'angular-strap':          '../vendor/angular/angular-strap',
    timepicker:               '../vendor/angular/timepicker',
    datepicker:               '../vendor/angular/datepicker',
    bindonce:                 '../vendor/angular/bindonce',
    crypto:                   '../vendor/crypto.min',
    spectrum:                 '../vendor/spectrum',

    jquery:                   '../vendor/jquery/jquery-2.1.1.min',

    bootstrap:                '../vendor/bootstrap/bootstrap',
    'bootstrap-tagsinput':    '../vendor/tagsinput/bootstrap-tagsinput',

    'extend-jquery':          'components/extend-jquery',

    'jquery.flot':            '../vendor/jquery/jquery.flot',
    'jquery.flot.pie':        '../vendor/jquery/jquery.flot.pie',
    'jquery.flot.events':     '../vendor/jquery/jquery.flot.events',
    'jquery.flot.selection':  '../vendor/jquery/jquery.flot.selection',
    'jquery.flot.stack':      '../vendor/jquery/jquery.flot.stack',
    'jquery.flot.stackpercent':'../vendor/jquery/jquery.flot.stackpercent',
    'jquery.flot.time':       '../vendor/jquery/jquery.flot.time',
    'jquery.flot.crosshair':  '../vendor/jquery/jquery.flot.crosshair',
    'jquery.flot.fillbelow':  '../vendor/jquery/jquery.flot.fillbelow',

    modernizr:                '../vendor/modernizr-2.6.1',
  },

  shim: {
    bootstrap: {
      deps: ['jquery']
    },

    modernizr: {
      exports: 'Modernizr'
    },

    angular: {
      deps: ['jquery', 'config'],
      exports: 'angular'
    },

    angularMocks: {
      deps: ['angular'],
    },

    crypto: {
      exports: 'Crypto'
    },

    'jquery.flot':          ['jquery'],
    'jquery.flot.pie':      ['jquery', 'jquery.flot'],
    'jquery.flot.events':   ['jquery', 'jquery.flot'],
    'jquery.flot.selection':['jquery', 'jquery.flot'],
    'jquery.flot.stack':    ['jquery', 'jquery.flot'],
    'jquery.flot.stackpercent':['jquery', 'jquery.flot'],
    'jquery.flot.time':     ['jquery', 'jquery.flot'],
    'jquery.flot.crosshair':['jquery', 'jquery.flot'],
    'jquery.flot.fillbelow':['jquery', 'jquery.flot'],

    'angular-route':        ['angular'],
    'angular-cookies':      ['angular'],
    'angular-dragdrop':     ['jquery', 'angular'],
    'angular-loader':       ['angular'],
    'angular-mocks':        ['angular'],
    'angular-resource':     ['angular'],
    'angular-touch':        ['angular'],
    'bindonce':             ['angular'],
    'angular-strap':        ['angular', 'bootstrap','timepicker', 'datepicker'],

    'bootstrap-tagsinput':          ['jquery'],

    timepicker:             ['jquery', 'bootstrap'],
    datepicker:             ['jquery', 'bootstrap'],
  }
});

require([
  'angular',
  'angularMocks',
  'app',
], function(angular) {
  'use strict';

  for (var file in window.__karma__.files) {
    if (/spec\.js$/.test(file)) {
      window.tests.push(file.replace(/^\/base\//, 'http://localhost:9876/base/'));
    }
  }


  angular.module('grafana', ['ngRoute']);
  angular.module('grafana.services', ['ngRoute', '$strap.directives']);
  angular.module('grafana.panels', []);
  angular.module('grafana.filters', []);

  require([
    'specs/lexer-specs',
    'specs/parser-specs',
    'specs/gfunc-specs',
    'specs/timeSeries-specs',
    'specs/row-ctrl-specs',
    'specs/graphiteTargetCtrl-specs',
    'specs/graphiteDatasource-specs',
    'specs/influxSeries-specs',
    'specs/influxQueryBuilder-specs',
    'specs/influxdb-datasource-specs',
    'specs/graph-ctrl-specs',
    'specs/grafanaGraph-specs',
    'specs/graph-tooltip-specs',
    'specs/seriesOverridesCtrl-specs',
    'specs/sharePanelCtrl-specs',
    'specs/timeSrv-specs',
    'specs/templateSrv-specs',
    'specs/templateValuesSrv-specs',
    'specs/kbn-format-specs',
    'specs/dashboardSrv-specs',
    'specs/dashboardViewStateSrv-specs'
  ], function () {
    window.__karma__.start();
  });

});

