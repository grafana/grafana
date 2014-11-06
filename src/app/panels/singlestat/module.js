define([
  'angular',
  'app',
  'lodash',
  'components/timeSeries',
  'kbn',
  'services/panelSrv',
  './singleStatPanel',
],
function (angular, app, _, TimeSeries, kbn) {
  'use strict';

  var module = angular.module('grafana.panels.singlestat');
  app.useModule(module);

  module.controller('SingleStatCtrl', function($scope, panelSrv, timeSrv) {

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
          src:'app/panels/singlestat/editor.html'
        }
      ],
      fullscreenEdit: true,
    };

    // Set and populate defaults
    var _d = {
      maxDataPoints: 100,
      interval: null,
      targets: [{}],
      cacheTimeout: null,
      format: 'none',
      prefix: '',
      postfix: '',
      valueName: 'avg',
      prefixFontSize: '50%',
      valueFontSize: '100%',
      postfixFontSize: '50%',
      thresholds: '',
      colorBackground: false,
      colorValue: false,
      colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
      sparkline: {
        show: false,
        full: false,
        lineColor: 'rgb(31, 120, 193)',
        fillColor: 'rgba(31, 118, 189, 0.18)',
      }
    };

    _.defaults($scope.panel, _d);

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

    $scope.getDecimalsForValue = function(value) {
      var opts = {};

      var delta = value / 2;
      var dec = -Math.floor(Math.log(delta) / Math.LN10);

      var magn = Math.pow(10, -dec),
          norm = delta / magn, // norm is between 1.0 and 10.0
          size;

      if (norm < 1.5) {
        size = 1;
      } else if (norm < 3) {
        size = 2;
        // special case for 2.5, requires an extra decimal
        if (norm > 2.25) {
          size = 2.5;
          ++dec;
        }
      } else if (norm < 7.5) {
        size = 5;
      } else {
        size = 10;
      }

      size *= magn;

      if (opts.minTickSize != null && size < opts.minTickSize) {
        size = opts.minTickSize;
      }

      var result = {};
      result.decimals = Math.max(0, dec);
      result.scaledDecimals = result.decimals - Math.floor(Math.log(size) / Math.LN10);
      return result;
    };

    $scope.render = function() {
      var data = {};

      if (!$scope.series || $scope.series.length === 0) {
        data.flotpairs = [];
        data.mainValue = Number.NaN;
        data.mainValueFormated = 'NaN';
      }
      else {
        var series = $scope.series[0];
        data.mainValue = series.stats[$scope.panel.valueName];
        var decimalInfo = $scope.getDecimalsForValue(data.mainValue);
        var formatFunc = kbn.valueFormats[$scope.panel.format];

        data.mainValueFormated = formatFunc(data.mainValue, decimalInfo.decimals, decimalInfo.scaledDecimals);
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
