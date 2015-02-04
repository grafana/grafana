define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'components/panelmeta',
],
function (angular, app, _, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.raintankMetricEventsPanel', []);
  app.useModule(module);

  app.useModule(module);
    module.directive('grafanaPanelRaintankmetriceventspanel', function() {
    return {
      controller: 'raintankMetricEventsPanel',
      templateUrl: 'plugins/raintank/panels/raintankMetricEventsPanel/module.html',
    };
  });
  module.controller('raintankMetricEventsPanel', function($scope, panelSrv, $q, timeSrv, raintankMetricEvent, raintankMetric) {
    console.log('raintankMetricEventsPanel');
    $scope.panelMeta = new PanelMeta({
      description : "Metric Events",
      fullscreenView: true
    });
    $scope.panelMeta.addEditorTab('Service ID', 'plugins/raintank/panels/raintankMetricEventsPanel/editor.html');


    // Set and populate defaults
    var _d = {
      service: null,
      metric: null,
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
      if ($scope.panel.service || $scope.panel.metric) {
        $scope.getMetrics();
        $scope.getEvents();
      }
    };

    $scope.getMetrics = function() {
      var filter = {};
      if ($scope.panel.service) {
        filter['parent.class'] = 'service';
        filter['parent.id'] = $scope.panel.service;
      }
      if ($scope.panel.metric) {
        filter['name'] = $scope.panel.metric;
      }
      var metricReq = raintankMetric.query(filter, function() {
        $scope.metrics = metricReq.metrics;
        var metricsById = {};
        _.forEach($scope.metrics, function(metric) {
          metricsById[metric._id] = metric;
        });
        $scope.metricsById = metricsById;
      });
    }

    $scope.getEvents = function() {
      var filter = {
        start: $scope.range.from.getTime(),
        end: $scope.range.to.getTime()
      }
      if ($scope.panel.service) {
        filter['parent.class'] = 'service';
        filter['parent.id'] = $scope.panel.service; 
      }
      if ($scope.panel.metric) {
        filter['metric'] = $scope.panel.metric;
      }
      var eventReq = raintankMetricEvent.query(filter, function() {
        $scope.metricEvents = eventReq.metricEvents;
        $scope.panel.title = "Events ("+$scope.metricEvents.length+")";
      });
    }

    $scope.init();
  });

});
