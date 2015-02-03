define([
  'angular',
  'app',
  'components/panelmeta',
],
function (angular, app, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.starred', []);
  app.useModule(module);

  module.directive('grafanaPanelStarred', function() {
    return {
      controller: 'StarredPanelCtrl',
      templateUrl: 'app/panels/starred/module.html',
    };
  });

  module.controller('StarredPanelCtrl', function($scope, panelSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Starred',
      editIcon:  "fa fa-star",
      fullscreen: true,
    });

    $scope.init = function() {
      panelSrv.init($scope);
    };

    $scope.init();
  });
});
