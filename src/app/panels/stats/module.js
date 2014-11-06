define([
  'angular',
  'app',
  'lodash',
  'components/timeSeries',
  'kbn',
  'services/panelSrv',
  './statsDirective',
],
function (angular, app, _, TimeSeries, kbn) {
  'use strict';

  var module = angular.module('grafana.panels.stats');
  app.useModule(module);

  module.controller('StatsCtrl', function($scope, panelSrv, timeSrv) {

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
        },
        {
          title: 'Options',
          src:'app/panels/stats/statsEditor.html'
        }
      ],
      fullscreenEdit: true,
    };

    // Set and populate defaults
    var _d = {
      targets: [{}],
      cacheTimeout: null,
      format: 'none',
      prefix: '',
      postfix: '',
      valueName: 'avg',
      thresholds: '',
      colorBackground: false,
      colorValue: false,
      colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
      sparkline: {
        show: false,
        full: false,
        lineColor: 'rgb(31, 120, 193)',
        fillColor: 'rgb(31, 120, 193)',
      }
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.$on('refresh', $scope.get_data);
    };

    $scope.formatValue = function(value) {
      return kbn.valueFormats[$scope.panel.format](value, 0, -7);
    };

    $scope.updateTimeRange = function () {
      $scope.range = timeSrv.timeRange();
      $scope.rangeUnparsed = timeSrv.timeRange(false);
    };

    $scope.get_data = function() {
      $scope.updateTimeRange();

      var metricsQuery = {
        range: $scope.rangeUnparsed,
        interval: '1min',
        targets: $scope.panel.targets,
        maxDataPoints: 100,
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
        info: { alias: seriesData.target },
      });

      series.flotpairs = series.getFlotPairs('connected');

      return series;
    };

    $scope.setColoring = function(options) {
      if (options.background) {
        $scope.panel.colorValue = false;
        $scope.panel.colors = ['rgba(71, 212, 59, 0.4)', 'rgba(245, 150, 40, 0.73)', 'rgba(225, 40, 40, 0.59)'];
      }
      else {
        $scope.panel.colorBackground = false;
        $scope.panel.colors = ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'];
      }
      $scope.render();
    };

    $scope.invertColorOrder = function() {
      var tmp = $scope.panel.colors[0];
      $scope.panel.colors[0] = $scope.panel.colors[2];
      $scope.panel.colors[2] = tmp;
      $scope.render();
    };

    $scope.render = function() {
      var data = {};

      if (!$scope.series || $scope.series.length === 0) {
        data.series = { mainValue: null, datapoints: [] };
      }
      else {
        var series = $scope.series[0];
        series.updateLegendValues(kbn.valueFormats[$scope.panel.format], 2, -7);
        data.mainValue = series.stats[$scope.panel.valueName];
        data.mainValueFormated = $scope.formatValue(data.mainValue);
        data.flotpairs = series.flotpairs;
      }

      data.thresholds = $scope.panel.thresholds.split(',').map(function(strVale) {
        return Number(strVale.trim());
      });

      data.colorMap = $scope.panel.colors;

      $scope.data = data;
      $scope.$emit('render');
    };

    $scope.init();
  });
});
