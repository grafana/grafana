/*

  ## filtering

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.filtering', []);
  app.useModule(module);

  module.controller('filtering', function($scope, filterSrv, graphiteSrv, $rootScope, dashboard) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "graphite target filters"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.filterSrv = filterSrv;
    };

    $scope.remove = function(filter) {
      filterSrv.remove(filter);
    };

    $scope.applyFilter = function(filter) {
      graphiteSrv.metricFindQuery(filter.query)
        .then(function (results) {
          filter.editing=undefined;
          filter.options = results;
        });
    };

    $scope.add = function() {
      filterSrv.add({
        type      : 'filter',
        name      : 'filter name',
        editing   : true,
        value     : '*',
        query     : 'metric.path.query.*',
      });
    };

    $scope.refresh = function() {
      dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

  });
});