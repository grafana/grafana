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
      coloring: {
        thresholds: '',
        background: false,
        value: false,
        colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"]
      },
      table: {
        show: true,
      }
    };

    _.defaults($scope.panel, _d);
    _.defaults($scope.panel.stats, _d.stats);
    _.defaults($scope.panel.coloring, _d.coloring);

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

    $scope.setColoring = function(options) {
      if (options.background) {
        $scope.panel.coloring.value = false;
        $scope.panel.coloring.colors = ['rgba(71, 212, 59, 0.4)', 'rgba(245, 150, 40, 0.73)', 'rgba(225, 40, 40, 0.59)'];
      }
      else {
        $scope.panel.coloring.background = false;
        $scope.panel.coloring.colors = ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'];
      }
      $scope.render();
    };

    $scope.invertColorOrder = function() {
      var tmp = $scope.panel.coloring.colors[0];
      $scope.panel.coloring.colors[0] = $scope.panel.coloring.colors[2];
      $scope.panel.coloring.colors[2] = tmp;
      $scope.render();
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

      data.thresholds = $scope.panel.coloring.thresholds.split(',').map(function(strVale) {
        return Number(strVale.trim());
      });

      data.colorMap = $scope.panel.coloring.colors;

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
          data.mainValue = null;

          if (!data || data.series.length === 0) {
            elem.html('no data');
            return;
          }

          render();
        });

        function applyColoringThresholds(value, valueString) {
          if (!scope.panel.coloring.value) {
            return valueString;
          }

          var color = getColorForValue(value);
          if (color) {
            return '<span style="color:' + color + '">'+ valueString + '</span>';
          }

          return valueString;
        }

        function getColorForValue(value) {
          for (var i = data.thresholds.length - 1; i >= 0 ; i--) {
            if (value > data.thresholds[i]) {
              return data.colorMap[i];
            }
          }
          return null;
        }

        function valueTemplateReplaceFunc(match, statType) {
          var stats = data.series[0].stats;
          data.mainValue = stats[statType];
          var valueFormated = scope.formatValue(data.mainValue);
          return applyColoringThresholds(data.mainValue, valueFormated);
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

          if (panel.coloring.background && data.mainValue) {
            var color = getColorForValue(data.mainValue);
            if (color) {
              elem.parents('.panel-container').css('background-color', color);
              if (scope.fullscreen) {
                elem.css('background-color', color);
              } else {
                elem.css('background-color', '');
              }
            }
          } else {
            elem.parents('.panel-container').css('background-color', '');
            elem.css('background-color', '');
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
