define([
  'angular',
  'app',
  'lodash',
  'config',
  'components/panelmeta',
],
function (angular, app, _, config, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.dashlist', []);
  app.useModule(module);

  module.directive('grafanaPanelDashlist', function() {
    return {
      controller: 'DashListPanelCtrl',
      templateUrl: 'app/panels/dashlist/module.html',
    };
  });

  module.controller('DashListPanelCtrl', function($scope, panelSrv, backendSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Dash list',
      editIcon:  "fa fa-star",
      fullscreen: true,
    });

    var defaults = {
    };

    _.defaults($scope.panel, defaults);

    $scope.dashList = [];

    $scope.init = function() {
      panelSrv.init($scope);

      if ($scope.isNewPanel()) {
        $scope.panel.title = "Starred Dashboards";
      }

      $scope.$on('refresh', $scope.get_data);
    };

    $scope.get_data = function() {
      backendSrv.get('/api/search', { starred: 1 }).then(function(result) {
        $scope.dashList = result.dashboards;
        $scope.panelMeta.loading = false;
      });
    };

    $scope.init();
  });
});
