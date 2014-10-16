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
      format: 'none',
      stats: {
        show: true,
        avg: true,
        template: '{{value}} {{func}}'
      },
      table: {
        show: true,
      }
    };

    _.defaults($scope.panel, _d);
    _.defaults($scope.panel.stats, _d.stats);

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

      return series;
    };

    $scope.render = function() {
      var i, series;
      var data = {
        series: $scope.series,
        stats: []
      };

      for (i = 0; i < data.series.length; i++) {
        series = data.series[i];
        series.updateLegendValues(kbn.valueFormats[$scope.panel.format], 2, -7);
      }

      $scope.data = data;
      $scope.$emit('render');
    };

    $scope.init();
  });

  module.directive('statsPanel', function() {

    return {
      link: function(scope, elem) {
        var data;
        var valueRegex = /\{\{([a-zA-Z]+)\}\}/g;
        var smallValueTextRegex = /!(\S+)/g;

        scope.$on('render', function() {
          data = scope.data;

          if (!data || data.series.length === 0) {
            elem.html('no data');
            return;
          }

          render();
        });

        function valueTemplateReplaceFunc(match, statType) {
          var stats = data.series[0].stats;
          var value = scope.formatValue(stats[statType]);
          return value;
        }

        function smallValueTextReplaceFunc(match, text) {
          return '<span class="stats-panel-value-small">' + text + '</span>';
        }

        function render() {
          var panel = scope.panel;
          var body = '';
          var i, series;

          if (panel.stats.show) {
            body += '<div class="stats-panel-value-container">';
            body += '<span class="stats-panel-value">';
            var valueHtml = panel.stats.template.replace(valueRegex, valueTemplateReplaceFunc);
            body += valueHtml.replace(smallValueTextRegex, smallValueTextReplaceFunc);
            body += '</div>';
            body += '</div>';
          }

          if (panel.table.show) {
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
