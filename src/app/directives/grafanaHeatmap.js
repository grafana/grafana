define([
  'angular',
  'jquery',
  'kbn',
  'moment',
  'lodash'
],
function (angular, $, kbn, moment, _) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('grafanaHeatmap', function($rootScope) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var data, plot, annotations;
        var hiddenData = {};
        var dashboard = scope.dashboard;
        var legendSideLastValue = null;
        var ymin, ymax;

        scope.$on('refresh',function() {
          scope.get_data();
        });

        scope.$on('toggleLegend', function(e, series) {
          _.each(series, function(serie) {
            if (hiddenData[serie.alias]) {
              data.push(hiddenData[serie.alias]);
              delete hiddenData[serie.alias];
            }
          });

          render_panel();
        });

        // Receive render events
        scope.$on('render',function(event, renderData) {
          data = renderData || data;
          if (!data) {
            scope.get_data();
            return;
          }
          annotations = data.annotations || annotations;
          render_panel();
        });

        // Re-render if the window is resized
        angular.element(window).bind('resize', function() {
          render_panel();
        });

        function setElementHeight() {
          try {
            var height = scope.height || scope.panel.height || scope.row.height;
            if (_.isString(height)) {
              height = parseInt(height.replace('px', ''), 10);
            }

            height = height - 32; // subtract panel title bar

            elem.css('height', height + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        function shouldAbortRender() {
          if (!data) {
            return true;
          }

          if ($rootScope.fullscreen && !scope.fullscreen) {
            return true;
          }

          if (!setElementHeight()) { return true; }

          if (_.isString(data)) {
            //render_panel_as_graphite_png(data);
            return true;
          }
        }

        // Function for rendering panel
        function render_panel() {
          if (shouldAbortRender()) {
            return;
          }

          var panel = scope.panel;

          _.each(_.keys(scope.hiddenSeries), function(seriesAlias) {
            var dataSeries = _.find(data, function(series) {
              return series.info.alias === seriesAlias;
            });
            if (dataSeries) {
              hiddenData[dataSeries.info.alias] = dataSeries;
              data = _.without(data, dataSeries);
            }
          });

          // Populate element
          var options = {
            legend: { show: false },
            yaxes: [],
            xaxis: {},
            grid: {
              minBorderMargin: 0,
              markings: [],
              backgroundColor: null,
              borderWidth: 0,
              hoverable: false,
              color: '#c8c8c8'
            },
            selection: {
              mode: "x",
              color: '#666'
            }
          };
          ymin = scope.panel.grid.leftMin;
          ymax = scope.panel.grid.leftMax;
          addTimeAxis(options);

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.applySeriesOverrides(panel.seriesOverrides);
            series.data = series.getHeatmapData(
              scope.panel.grid.leftMin, scope.panel.grid.leftMax, null, scope.panel.grid.bucketCount);
            if (series.data.length > 0) {
              ymin = series.info.buckets[0];
              ymax = series.info.buckets[series.info.buckets.length - 1] + series.info.bucketSize;
              addHeatmapMarkings(series.data, series.info, options);
              break;
            }
          }

          configureAxisOptions(data, options);

          // if legend is to the right delay plot draw a few milliseconds
          // so the legend width calculation can be done
          if (shouldDelayDraw(panel)) {
            legendSideLastValue = panel.legend.rightSide;
            setTimeout(function() {
              plot = $.plot(elem, [], options);
              addAxisLabels();
            }, 50);
          }
          else {
            plot = $.plot(elem, [], options);
            addAxisLabels();
          }
        }

        function componentFromStr(numStr, percent) {
          var num = Math.max(0, parseInt(numStr, 10));
          return percent ?
              Math.floor(255 * Math.min(100, num) / 100) : Math.min(255, num);
        }

        //Converts the given color in 'rgba(x, x, x, x.x)' format to #xxx including the given multiplier in range 0-1 to dim the color.
        function convertColor(rgb, multiplier) {
          var rgbRegex = /^rgba?\(\s*(-?\d+)(%?)\s*,\s*(-?\d+)(%?)\s*,\s*(-?\d+)(%?)\s*(,\s*(-?\d+(\.\d+)?)(%?))?\s*\)$/;
          var result, r, g, b, hex = "";
          if (result = rgbRegex.exec(rgb)) {
            r = componentFromStr(result[1], result[2]);
            g = componentFromStr(result[3], result[4]);
            b = componentFromStr(result[5], result[6]);

            r = Math.round(r * multiplier) << 16;
            g = Math.round(g * multiplier) << 8;
            b = Math.round(b * multiplier);

            hex = "#" + (0x1000000 + r + b + g).toString(16).slice(1);
          }
          return hex;
        }

        //Draws the heatmap using markings
        function addHeatmapMarkings(dataSeries, info, options) {

          var ypoints = info.buckets.length;
          var yheight = info.bucketSize;

          var xmin = options.xaxis.min;
          var xmax = options.xaxis.max;
          var xpoints = dataSeries.length;
          var xwidth = dataSeries.length >= 2 ? dataSeries[1][0] - dataSeries[0][0] : xmax - xmin;
          var minValue = scope.panel.grid.depthMin != null ? scope.panel.grid.depthMin : info.min;
          var maxValue = scope.panel.grid.depthMax != null ? scope.panel.grid.depthMax : info.max;
          var valueRange = maxValue - minValue;
          if (valueRange <= 0) {
            valueRange = 1;
          }

          for (var ix = 0; ix < xpoints; ++ix) {
            var timePoint = dataSeries[ix][0];
            for (var iy = 0; iy < ypoints; ++iy) {
              var value = dataSeries[ix][1][iy];
              value = Math.max(0, Math.min(1, (value - minValue) / valueRange));
              options.grid.markings.push({
                xaxis: { from: timePoint, to: timePoint + xwidth },
                yaxis: { from: ymin + iy * yheight, to: ymin + (iy + 1) * yheight },
                color: convertColor(scope.panel.grid.mapColor, value),
              });
            }
          }
        }

        function shouldDelayDraw(panel) {
          if (panel.legend.rightSide) {
            return true;
          }
          if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
            return true;
          }
          return false;
        }

        function addTimeAxis(options) {
          var ticks = elem.width() / 100;
          var min = _.isUndefined(scope.range.from) ? null : scope.range.from.getTime();
          var max = _.isUndefined(scope.range.to) ? null : scope.range.to.getTime();

          options.xaxis = {
            timezone: dashboard.timezone,
            show: scope.panel['x-axis'],
            mode: "time",
            min: min,
            max: max,
            label: "Datetime",
            ticks: ticks,
            timeformat: time_format(scope.interval, ticks, min, max),
          };
        }

        function addAxisLabels() {
          if (scope.panel.leftYAxisLabel) {
            elem.css('margin-left', '10px');
            var yaxisLabel = $("<div class='axisLabel yaxisLabel'></div>")
              .text(scope.panel.leftYAxisLabel)
              .appendTo(elem);

            yaxisLabel.css("margin-top", yaxisLabel.width() / 2 - 20);
          } else if (elem.css('margin-left')) {
            elem.css('margin-left', '');
          }
        }

        function configureAxisOptions(data, options) {
          var defaults = {
            position: 'left',
            show: scope.panel['y-axis'],
            min: ymin,
            max: ymax,
          };

          options.yaxes.push(defaults);

          configureAxisMode(options.yaxes[0], scope.panel.y_formats[0]);
        }

        function configureAxisMode(axis, format) {
          axis.tickFormatter = kbn.getFormatFunction(format, 1);
        }

        function time_format(interval, ticks, min, max) {
          if (min && max && ticks) {
            var secPerTick = ((max - min) / ticks) / 1000;

            if (secPerTick <= 45) {
              return "%H:%M:%S";
            }
            if (secPerTick <= 3600) {
              return "%H:%M";
            }
            if (secPerTick <= 80000) {
              return "%m/%d %H:%M";
            }
            if (secPerTick <= 2419200) {
              return "%m/%d";
            }
            return "%Y-%m";
          }

          return "%H:%M";
        }

        elem.bind("plotselected", function (event, ranges) {
          scope.$apply(function() {
            scope.filter.setTime({
              from  : moment.utc(ranges.xaxis.from).toDate(),
              to    : moment.utc(ranges.xaxis.to).toDate(),
            });
          });
        });
      }
    };
  });

});
