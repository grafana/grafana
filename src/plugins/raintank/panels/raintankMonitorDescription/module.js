define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'components/panelmeta',
],
function (angular, app, _, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankMonitorDescription', []);
  app.useModule(module);

  var converter;

  module.controller('raintankMonitorDescription', function($scope, panelSrv, backendSrv) {
    $scope.panelMeta = new PanelMeta({
      description : "Raintank Monitor details.",
      fullscreenView: true
    });
    $scope.panelMeta.addEditorTab('Monitor ID', 'plugins/raintank/panels/raintankMonitorDescription/editor.html');
    $scope.reloadPanels = false;
    // Set and populate defaults
    var _d = {
      service: null,
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init(this);
      $scope.panelsLoaded = false;
      $scope.$on('refresh', $scope.render);
      //initialize our list of locations.
      backendSrv.get('/api/locations').then(function(locations) {
        $scope.locations = locations;
        $scope.render();
      });
    };

    $scope.render = function() {
      if ($scope.panel.monitor) {
        backendSrv.get('/api/monitors/'+$scope.panel.monitor).then(function(monitor) {
          $scope.monitor = monitor;
          backendSrv.get('/api/monitor_types').then(function(types) {
            var found = false;
            _.forEach(types, function(type) {
              if (found) {
                return;
              }
              if (type.id == monitor.monitor_type_id) {
                $scope.monitor_type = type;
              }
            });
          });
        });
      }
    };

    $scope.openEditor = function() {
    };

    $scope.init();
  });

});
