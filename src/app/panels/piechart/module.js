define([
  'angular',
  'app',
  'lodash',
  'components/timeSeries',
  'kbn',
  'components/panelmeta',
  './pieChartPanel',
],
function (angular, app, _, TimeSeries, kbn, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.piechart');
  app.useModule(module);

  module.controller('PieChartCtrl', function($scope, $rootScope, panelSrv, timeSrv) {

    $scope.panelMeta = new PanelMeta({
      description: 'Pie chart panel',
      fullscreen: true,
      metricsEditor: true
    });

    $scope.panelMeta.addEditorTab('Options', 'app/panels/piechart/editor.html');

    // Set and populate defaults
    var _d = {
      legend: {
        show: false
      },
      pieType: 'pie'
    };

    _.defaults($scope.panel, _d);
    $scope.unitFormats = kbn.getUnitFormats();

    $scope.setUnitFormat = function(subItem) {
      $scope.panel.format = subItem.value;
      $scope.render();
    };

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.$on('refresh', $scope.get_data);
    };

    $scope.updateTimeRange = function () {
      $scope.range = timeSrv.timeRange();
      $scope.rangeUnparsed = timeSrv.timeRange(false);
      $scope.resolution = $scope.panel.maxDataPoints;
      $scope.interval = kbn.calculateInterval($scope.range, $scope.resolution, $scope.panel.interval);
    };

    $scope.get_data = function() {
      $scope.updateTimeRange();

      var metricsQuery = {
        range: $scope.rangeUnparsed,
        interval: $scope.interval,
        targets: $scope.panel.targets,
        maxDataPoints: $scope.resolution,
        cacheTimeout: $scope.panel.cacheTimeout
      };

      return $scope.datasource.query(metricsQuery)
        .then($scope.dataHandler)
        .then(null, function(err) {
          console.log("err");
          $scope.panelMeta.loading = false;
          $scope.panelMeta.error = err.message || "Timeseries data request error";
          $scope.inspector.error = err;
          $scope.render();
        });
    };

    $scope.dataHandler = function(results) {
      $scope.panelMeta.loading = false;
      $scope.series = _.map(results.data, $scope.seriesHandler);
      $scope.render();
    };

    $scope.seriesHandler = function(seriesData) {
      var series = new TimeSeries({
        datapoints: seriesData.datapoints,
        alias: seriesData.target,
      });

      series.flotpairs = series.getFlotPairs($scope.panel.nullPointMode);

      return series;
    };

    $scope.render = function() {
      var data = [];

      if ($scope.series && $scope.series.length > 0) {
        for (var i=0; i < $scope.series.length; i++) {
          data.push({label: $scope.series[i].alias, data: $scope.series[i].stats.current, color: $rootScope.colors[i]});
        }
      }

      $scope.data = data;
      $scope.$emit('render');
    };

    $scope.init();
  });
});
