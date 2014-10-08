define([
  'angular',
  'app',
  'lodash',
  'components/timeSeries',
  'kbn',
  'services/panelSrv',
],
function (angular, app, _, TimeSeries, kbn) {
  'use strict';

  var module = angular.module('grafana.panels.stats', []);
  app.useModule(module);

  module.controller('StatsCtrl', function($scope, panelSrv, timeSrv, $rootScope) {

    $scope.panelMeta = {
      titlePos: 'left',
      description : "A stats values panel",
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
      panelSrv.init($scope);
    };

    $scope.formatValue = function(value) {
      return kbn.valueFormats.bytes(value, 0, -7);
    };

    $scope.get_data = function() {
      console.log("stats get data");
      $scope.rangeUnparsed = timeSrv.timeRange(false);

      var metricsQuery = {
        range: $scope.rangeUnparsed,
        interval: '1min',
        targets: $scope.panel.targets,
        maxDataPoints: 100,
      };

      return $scope.datasource.query(metricsQuery)
        .then($scope.dataHandler)
        .then(null, function(err) {
          console.log("err");
          $scope.panelMeta.loading = false;
          $scope.panelMeta.error = err.message || "Timeseries data request error";
          $scope.inspector.error = err;
          $scope.render([]);
        });
    };

    $scope.dataHandler = function(results) {
      $scope.panelMeta.loading = false;
      $scope.series = _.map(results.data, $scope.seriesHandler);

      if ($scope.series.length > 0) {
        var mainstat = $scope.series[0];
        $scope.mainstat = {};
        $scope.mainstat.value = $scope.formatValue(mainstat.stats.avg);
        $scope.mainstat.func = 'avg';
      }
    };

    $scope.seriesHandler = function(seriesData, index) {
      var datapoints = seriesData.datapoints;
      var alias = seriesData.target;
      var color = $rootScope.colors[index];

      var seriesInfo = {
        alias: alias,
        enable: true,
        color: color
      };

      var series = new TimeSeries({
        datapoints: datapoints,
        info: seriesInfo,
      });

      series.points = series.getFlotPairs('connected');
      series.updateLegendValues(kbn.valueFormats.bytes, 2, -7);

      return series;
    };

    $scope.render = function() {
    };

    $scope.openEditor = function() {
    };

    $scope.init();
  });
});
