/*

  ## datasource: provides a global override for the datasource settings on this dashboard

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.datasource', []);
  app.useModule(module);

  module.controller('datasource', function($scope, datasourceSrv, $rootScope, dashboard) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "datasource global override"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.datasources = datasourceSrv.listOptionsForGlobalOverride();
      $scope.setDatasource($scope.panel.datasource);
    };

    $scope.setDatasource = function(datasource) {
      $scope.panel.datasource = datasource;
      $scope.datasource = datasourceSrv.get(datasource);
      if (!$scope.datasource) {
          $scope.panel.error = "Cannot find datasource " + datasource;
          return;
      }
      dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

  });
});