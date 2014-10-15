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
        },
        {
          title: 'Display Styles',
          src:'app/panels/stats/statsEditor.html'
        }
      ],
      fullscreenEdit: true,
    };

    // Set and populate defaults
    var _d = {
      targets: [{}],
      cacheTimeout: null,
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.$on('refresh', $scope.get_data);
    };

    $scope.formatValue = function(value) {
      return kbn.valueFormats.bytes(value, 0, -7);
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
      var data= {};
      data.series = _.map(results.data, $scope.seriesHandler);
      data.stats = [];

      if (data.series.length > 0) {
        var stat = {};
        var firstSeries = data.series[0];
        stat.value = $scope.formatValue(firstSeries.stats.avg);
        stat.func = 'avg';
        data.stats.push(stat);
      }

      $scope.data = data;
      $scope.render();
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
      $scope.$emit('render');
    };

    $scope.init();
  });

  module.directive('statsPanel', function() {

    return {
      link: function(scope, elem) {
        var data;

        console.log('asd');
        scope.$on('render', function() {
          data = scope.data;

          if (!data || data.series.length === 0) {
            elem.html('no data');
            return;
          }

          render();
        });

        function render() {
          var body = '';
          var i, series;

          if (scope.panel.stats) {
            body += '<div class="stats-panel-value-container">';
            body += '<span class="stats-panel-value">' + data.stats[0].value + '</span>';
            body += ' <span class="stats-panel-func">(' + data.stats[0].func + ')</span>';
            body += '</div>';
          }

          if (scope.panel.table) {
            body += '<table class="stats-panel-table">';
            body += '<tr>';
            body += '<th></th><th>avg</th><th>min</th><th>max</th><th>current</th><th>total</th>';
            body += '</tr>';
            for (i = 0; i < data.series.length; i++) {
              series = data.series[i];
              body += '<tr>';
              body += '<td><i class="icon-minus pointer" style="color:' + series.color + '"></i> ';
              body += series.info.alias + ' </td>';
              body += '<td>' + series.info.avg + '</td>';
              body += '<td>' + series.info.min + '</td>';
              body += '<td>' + series.info.max + '</td>';
              body += '<td>' + series.info.total + '</td>';
              body += '<td>' + series.info.current + '</td>';
            }
            body += '</table>';
          }

          elem.html(body);
        }
      }
    };
  });

});
