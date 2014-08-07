define([
  'angular',
  'app',
  'underscore',
  'services/panelSrv'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('grafana.panels.overview', []);
  app.useModule(module);

  module.controller('OverviewCtrl', function($scope, panelSrv) {

    $scope.panelMeta = {
      description : "A panel to show an overview of different metrics through avg, total, current numbers and sparklines",
      fullEditorTabs : [
        {
          title: 'General',
          src:'app/partials/panelgeneral.html'
        },
        {
          title: 'Metrics',
          src:'app/partials/metrics.html'
        }
      ],
      fullscreenEdit: true,
    };

    // Set and populate defaults
    var _d = {
      targets: [{}]
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init(this);

      if (!$scope.skipDataOnInit) {
        $scope.get_data();
      }
      //$scope.$on('refresh', $scope.render);
      //$scope.render();
    };

    $scope.get_data = function() {
      delete $scope.panel.error;
      $scope.panelMeta.loading = true;

      $scope.rangeUnparsed = $scope.filter.timeRange(false);

      var metricsQuery = {
        range: $scope.rangeUnparsed,
        interval: '1min',
        targets: $scope.panel.targets,
        maxDataPoints: 100,
      };

      return $scope.datasource.query($scope.filter, metricsQuery)
        .then($scope.dataHandler)
        .then(null, function(err) {
          $scope.panelMeta.loading = false;
          $scope.panel.error = err.message || "Timeseries data request error";
          $scope.inspector.error = err;
          $scope.render([]);
        });
    };

    $scope.dataHandler = function(results) {
      $scope.panelMeta.loading = false;
      var data = _.map(results.data, $scope.seriesHandler);
      $scope.render(data);
    };

    $scope.seriesHandler = function(seriesData, index) {
      var datapoints = seriesData.datapoints;
      var alias = seriesData.target;
      var color = $scope.panel.aliasColors[alias] || $scope.colors[index];
      var yaxis = $scope.panel.aliasYAxis[alias] || 1;

      var seriesInfo = {
        alias: alias,
        color:  color,
        enable: true,
        yaxis: yaxis
      };

      $scope.legend.push(seriesInfo);

      var series = new timeSeries.ZeroFilled({
        datapoints: datapoints,
        info: seriesInfo,
      });

      if (datapoints && datapoints.length > 0) {
        var last = moment.utc(datapoints[datapoints.length - 1][1] * 1000);
        var from = moment.utc($scope.range.from);
        if (last - from < -10000) {
          $scope.datapointsOutside = true;
        }

        $scope.datapointsCount += datapoints.length;
      }

      return series;
    };

    $scope.render = function() {

    };

    $scope.openEditor = function() {
    };

    $scope.init();

  });
});
