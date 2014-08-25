/*

  ## filtering

*/
define([
  'angular',
  'app',
  'lodash'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('grafana.panels.filtering', []);
  app.useModule(module);

  module.controller('filtering', function($scope, datasourceSrv, $rootScope, $timeout, $q) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "graphite target filters"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      // empty. Don't know if I need the function then.
    };

    $scope.remove = function(templateParameter) {
      $scope.filter.removeTemplateParameter(templateParameter);
    };

    $scope.add = function() {
      $scope.filter.addTemplateParameter({
        type      : 'filter',
        name      : 'filter name',
        editing   : true,
        query     : 'metric.path.query.*',
      });
    };

  });
});
