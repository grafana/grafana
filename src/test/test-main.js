require.config({
  baseUrl: 'base/app',

  paths: {
    specs:                 '../test/specs',
    mocks:                 '../test/mocks',
    config:                '../config.sample',
    kbn:                   'components/kbn',

    settings:              'components/settings',
    underscore:            'components/underscore.extended',
    'underscore-src':      '../vendor/underscore',

    moment:                '../vendor/moment',
    chromath:              '../vendor/chromath',
    filesaver:             '../vendor/filesaver',

    angular:               '../vendor/angular/angular',
    angularMocks:          '../vendor/angular/angular-mocks',
    'angular-dragdrop':       '../vendor/angular/angular-dragdrop',
    'angular-strap':          '../vendor/angular/angular-strap',
    'angular-sanitize':       '../vendor/angular/angular-sanitize',
    timepicker:               '../vendor/angular/timepicker',
    datepicker:               '../vendor/angular/datepicker',
    bindonce:                 '../vendor/angular/bindonce',
    crypto:                   '../vendor/crypto.min',
    spectrum:                 '../vendor/spectrum',

    jquery:                   '../vendor/jquery/jquery-1.8.0',

    bootstrap:                '../vendor/bootstrap/bootstrap',
    'bootstrap-tagsinput':    '../vendor/tagsinput/bootstrap-tagsinput',

    'jquery-ui':              '../vendor/jquery/jquery-ui-1.10.3',

    'extend-jquery':          'components/extend-jquery',

    'jquery.flot':            '../vendor/jquery/jquery.flot',
    'jquery.flot.pie':        '../vendor/jquery/jquery.flot.pie',
    'jquery.flot.events':     '../vendor/jquery/jquery.flot.events',
    'jquery.flot.selection':  '../vendor/jquery/jquery.flot.selection',
    'jquery.flot.stack':      '../vendor/jquery/jquery.flot.stack',
    'jquery.flot.stackpercent':'../vendor/jquery/jquery.flot.stackpercent',
    'jquery.flot.time':       '../vendor/jquery/jquery.flot.time',
    'jquery.flot.byte':       '../vendor/jquery/jquery.flot.byte',

    modernizr:                '../vendor/modernizr-2.6.1',
    elasticjs:                '../vendor/elasticjs/elastic-angular-client',
  },

  shim: {
    underscore: {
      exports: '_'
    },

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

    'jquery-ui':            ['jquery'],
    'jquery.flot':          ['jquery'],
    'jquery.flot.byte':     ['jquery', 'jquery.flot'],
    'jquery.flot.pie':      ['jquery', 'jquery.flot'],
    'jquery.flot.events':   ['jquery', 'jquery.flot'],
    'jquery.flot.selection':['jquery', 'jquery.flot'],
    'jquery.flot.stack':    ['jquery', 'jquery.flot'],
    'jquery.flot.stackpercent':['jquery', 'jquery.flot'],
    'jquery.flot.time':     ['jquery', 'jquery.flot'],

    'angular-sanitize':     ['angular'],
    'angular-cookies':      ['angular'],
    'angular-dragdrop':     ['jquery','jquery-ui','angular'],
    'angular-loader':       ['angular'],
    'angular-mocks':        ['angular'],
    'angular-resource':     ['angular'],
    'angular-route':        ['angular'],
    'angular-touch':        ['angular'],
    'bindonce':             ['angular'],
    'angular-strap':        ['angular', 'bootstrap','timepicker', 'datepicker'],

    'bootstrap-tagsinput':          ['jquery'],


    timepicker:             ['jquery', 'bootstrap'],
    datepicker:             ['jquery', 'bootstrap'],

    elasticjs:              ['angular', '../vendor/elasticjs/elastic'],
  }
});

require([
  'angular',
  'angularMocks',
  'jquery',
  'underscore',
  'elasticjs',
  'bootstrap',
  'angular-sanitize',
  'angular-strap',
  'angular-dragdrop',
  'extend-jquery',
  'bindonce'
], function(angular) {
  'use strict';

  angular.module('kibana', []);
  angular.module('kibana.services', ['$strap.directives']);
  angular.module('kibana.panels', []);
  angular.module('kibana.filters', []);

  require([
    'specs/lexer-specs',
    'specs/parser-specs',
    'specs/gfunc-specs',
    'specs/filterSrv-specs',
    'specs/kbn-format-specs',
  ], function () {
    window.__karma__.start();
  });

});
