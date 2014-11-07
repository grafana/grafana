define([
  'angular',
  'app',
  'lodash',
  'kbn',
  'jquery',
  'jquery.flot',
  'jquery.flot.time',
],
function (angular, app, _, kbn, $) {
  'use strict';

  var module = angular.module('grafana.panels.graph');

  module.directive('graphLegend', function(popoverSrv) {

    return {
      link: function(scope, elem) {
        var $container = $('<section class="graph-legend"></section>');
        var firstRender = true;
        var panel = scope.panel;
        var data;
        var i;

        scope.$on('render', function(event, renderData) {
          data = renderData || data;
          if (data) {
            render();
          }
        });

        function getSeriesIndexForElement(el) {
          return el.parents('[data-series-index]').data('series-index');
        }

        function openColorSelector(e) {
          var el = $(e.currentTarget);
          var index = getSeriesIndexForElement(el);
          var seriesInfo = data[index].info;
          var popoverScope = scope.$new();
          popoverScope.series = seriesInfo;
          popoverSrv.show({
            element: $(':first-child', el),
            templateUrl:  'app/panels/graph/legend.popover.html',
            scope: popoverScope
          });
        }

        function toggleSeries(e) {
          var el = $(e.currentTarget);
          var index = getSeriesIndexForElement(el);
          var seriesInfo = data[index].info;
          scope.toggleSeries(seriesInfo, e);
        }

        function render() {
          if (firstRender) {
            elem.append($container);
            $container.on('click', '.graph-legend-icon', openColorSelector);
            $container.on('click', '.graph-legend-alias', toggleSeries);
            firstRender = false;
          }

          $container.empty();

          $container.toggleClass('graph-legend-table', panel.legend.alignAsTable);

          if (panel.legend.bigTableMode) {
            $container.toggleClass('graph-legend-big-table', true);
            var header = '<tr>';
            header += '<th></th>';
            header += '<th></th>';
            header += '<th>min</th>';
            header += '<th>max</th>';
            header += '<th>avg</th>';
            header += '<th>current</th>';
            header += '<th>total</th>';
            header += '</tr>';
            $container.append($(header));
          }

          for (i = 0; i < data.length; i++) {
            var series = data[i];
            var html = '<div class="graph-legend-series';
            if (series.info.yaxis === 2) { html += ' pull-right'; }
            if (scope.hiddenSeries[series.label]) { html += ' graph-legend-series-hidden'; }
            html += '" data-series-index="' + i + '">';
            html += '<div class="graph-legend-icon">';
            html += '<i class="icon-minus pointer" style="color:' + series.color + '"></i>';
            html += '</div>';

            html += '<div class="graph-legend-alias small">';
            html += '<a>' + series.label + '</a>';
            html += '</div>';

            if (panel.legend.values) {
              if (panel.legend.min) { html += '<div class="graph-legend-value min small">' + series.info.min + '</div>'; }
              if (panel.legend.max) { html += '<div class="graph-legend-value max small">' + series.info.max + '</div>'; }
              if (panel.legend.avg) { html += '<div class="graph-legend-value avg small">' + series.info.avg + '</div>'; }
              if (panel.legend.current) { html += '<div class="graph-legend-value current small">' + series.info.current + '</div>'; }
              if (panel.legend.total) { html += '<div class="graph-legend-value total small">' + series.info.total + '</div>'; }
            }

            html += '</div>';
            $container.append($(html));
          }
        }
      }
    };
  });

});
