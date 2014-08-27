define([
  'angular',
  'lodash',
  'kbn',
  'store'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateSrv', function() {

    this.init = function(dashboard) {
      this.dashboard = dashboard;

    };

  });

});
