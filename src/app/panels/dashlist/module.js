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

    $scope.panelMeta.addEditorTab('Options', 'app/panels/dashlist/editor.html');

    var defaults = {
      mode: 'starred',
      query: '',
      tag: '',
    };

    $scope.modes = ['starred', 'search'];

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
      var params = {};
      if ($scope.panel.mode === 'starred') {
        params.starred = 1;
      } else {
        params.q = "tags:" + $scope.panel.tag + " AND title:" + $scope.panel.query;
      }

      backendSrv.get('/api/search', params).then(function(result) {
        $scope.dashList = result.dashboards;
        $scope.panelMeta.loading = false;
      });
    };

    $scope.init();
  });
});
