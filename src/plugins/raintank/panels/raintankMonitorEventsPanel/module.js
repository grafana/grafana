define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'components/panelmeta',
],
function (angular, app, _, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankMonitorEventsPanel', []);
  app.useModule(module);

  app.useModule(module);
    module.directive('grafanaPanelRaintankmonitoreventspanel', function() {
    return {
      controller: 'raintankMonitorEventsPanel',
      templateUrl: 'plugins/raintank/panels/raintankMonitorEventsPanel/module.html',
    };
  });

  module.controller('raintankMonitorEventsPanel', function($scope, panelSrv, $q, timeSrv, raintankServiceEvent) {
    console.log('raintankMonitorEventsPanel');
    $scope.panelMeta = new PanelMeta({
      description : "Service Events",
      fullscreenView: true
    });
    $scope.panelMeta.addEditorTab('Service ID', 'plugins/raintank/panels/raintankMonitorEventsPanel/editor.html');

    // Set and populate defaults
    var _d = {
      service: null,
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init(this);
      $scope.$on('refresh', $scope.render);
      $scope.render();
    };

    $scope.render = function() {
      console.log("rendering events panel");
      $scope.range = timeSrv.timeRange();
      if ($scope.panel.service) {
        $scope.getEvents();
      }
    };

    $scope.getEvents = function() {
      var eventReq = raintankServiceEvent.query({service: $scope.panel.service, start: $scope.range.from.getTime(), end: $scope.range.to.getTime()}, function() {
        $scope.serviceEvents = eventReq.serviceEvents;
        $scope.panel.title = "Events ("+$scope.serviceEvents.length+")";
      });
    }

    $scope.init();
  });

});
