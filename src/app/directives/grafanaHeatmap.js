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

            if (scope.panel.legend.show && !scope.panel.legend.rightSide) {
              height = height - 21; // subtract one line legend
            }

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
            render_panel_as_graphite_png(data);
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

          var stack = panel.stack ? true : null;

          // Populate element
          var options = {
            legend: { show: false },
            series: {
              stackpercent: false,
              stack: null,
              lines:  {
                show: false
              },
              bars:   {
                show: false
              },
              points: {
                show: false
              },
              shadowSize: 1
            },
            yaxes: [],
            xaxis: {},
            grid: {
              minBorderMargin: 0,
              markings: [],
              backgroundColor: null,
              borderWidth: 0,
              hoverable: true,
              color: '#c8c8c8'
            },
            selection: {
              mode: "x",
              color: '#666'
            }
          };

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.applySeriesOverrides(panel.seriesOverrides);
            series.data = series.getHeatmapData(panel.nullPointMode, panel.y_formats, scope.panel.grid.leftMin, scope.panel.grid.leftMax);
          }

          addTimeAxis(options);

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            if (!_.isEmpty(series.data)) {
              addHeatmapMarkings(series.data, options);
              break;
            }
          }

          addAnnotations(options);
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

        function translateFillOption(fill) {
          return fill === 0 ? 0.001 : fill/10;
        }

        function addHeatmapMarkings(dataSeries, options) {

          var ymin = dataSeries.buckets[0];
          var ymax = dataSeries.buckets[dataSeries.buckets.length - 1] + dataSeries.bucketSize;
          var ypoints = dataSeries.buckets.length;
          var yheight = dataSeries.bucketSize;

          scope.panel.grid.leftMin = ymin
          scope.panel.grid.leftMax = ymax

          var xmin = options.xaxis.min;
          var xmax = options.xaxis.max;
          var xpoints = dataSeries.values.length;
          var xwidth = (xmax - xmin) / xpoints;
          var valueColorMultiplier = (dataSeries.max - dataSeries.min) / 255.0;

          for (var ix = 0; ix < xpoints; ++ix) {
            for (var iy = 0; iy < ypoints; ++iy) {
              var value = dataSeries.values[ix][1][iy];
              value = Math.round((value - dataSeries.min) / valueColorMultiplier);
              var colorVar = value.toString(16);
              if (colorVar.length == 1)
                colorVar = '0' + colorVar;
              options.grid.markings.push({
                xaxis: { from: xmin + ix * xwidth, to: xmin + (ix + 1) * xwidth -(xwidth / 5) },
                yaxis: { from: ymin + iy * yheight, to: ymin + (iy + 1) * yheight -(yheight / 5)},
                color: '#' + colorVar + '0000'
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

        function addAnnotations(options) {
          if(!annotations || annotations.length === 0) {
            return;
          }

          var types = {};

          _.each(annotations, function(event) {
            if (!types[event.annotation.name]) {
              types[event.annotation.name] = {
                level: _.keys(types).length + 1,
                icon: {
                  icon: "icon-chevron-down",
                  size: event.annotation.iconSize,
                  color: event.annotation.iconColor,
                }
              };
            }

            if (event.annotation.showLine) {
              options.grid.markings.push({
                color: event.annotation.lineColor,
                lineWidth: 1,
                xaxis: { from: event.min, to: event.max }
              });
            }
          });

          options.events = {
            levels: _.keys(types).length + 1,
            data: annotations,
            types: types
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
            min: scope.panel.grid.leftMin,
            max: scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.leftMax,
          };

          options.yaxes.push(defaults);

          if (_.findWhere(data, {yaxis: 2})) {
            var secondY = _.clone(defaults);
            secondY.position = 'right';
            secondY.min = scope.panel.grid.rightMin;
            secondY.max = scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.rightMax;
            options.yaxes.push(secondY);
            configureAxisMode(options.yaxes[1], scope.panel.y_formats[1]);
          }

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

        var $tooltip = $('<div id="tooltip">');

        elem.bind("plothover", function (event, pos, item) {
          var group, value, timestamp, seriesInfo, format;

          if (item) {
            seriesInfo = item.series.info;
            format = scope.panel.y_formats[seriesInfo.yaxis - 1];

            if (seriesInfo.alias) {
              group = '<small style="font-size:0.9em;">' +
                '<i class="icon-circle" style="color:'+item.series.color+';"></i>' + ' ' +
                seriesInfo.alias +
              '</small><br>';
            } else {
              group = kbn.query_color_dot(item.series.color, 15) + ' ';
            }

            if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
              value = item.datapoint[1] - item.datapoint[2];
            }
            else {
              value = item.datapoint[1];
            }

            value = kbn.getFormatFunction(format, 2)(value);
            timestamp = dashboard.formatDate(item.datapoint[0]);

            $tooltip.html(group + value + " @ " + timestamp).place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.detach();
          }
        });

        function render_panel_as_graphite_png(url) {
          url += '&width=' + elem.width();
          url += '&height=' + elem.css('height').replace('px', '');
          url += '&bgcolor=1f1f1f'; // @grayDarker & @grafanaPanelBackground
          url += '&fgcolor=BBBFC2'; // @textColor & @grayLighter
          url += scope.panel.stack ? '&areaMode=stacked' : '';
          url += scope.panel.fill !== 0 ? ('&areaAlpha=' + (scope.panel.fill/10).toFixed(1)) : '';
          url += scope.panel.linewidth !== 0 ? '&lineWidth=' + scope.panel.linewidth : '';
          url += scope.panel.legend.show ? '&hideLegend=false' : '&hideLegend=true';
          url += scope.panel.grid.leftMin !== null ? '&yMin=' + scope.panel.grid.leftMin : '';
          url += scope.panel.grid.leftMax !== null ? '&yMax=' + scope.panel.grid.leftMax : '';
          url += scope.panel.grid.rightMin !== null ? '&yMin=' + scope.panel.grid.rightMin : '';
          url += scope.panel.grid.rightMax !== null ? '&yMax=' + scope.panel.grid.rightMax : '';
          url += scope.panel['x-axis'] ? '' : '&hideAxes=true';
          url += scope.panel['y-axis'] ? '' : '&hideYAxis=true';

          switch(scope.panel.y_formats[0]) {
          case 'bytes':
            url += '&yUnitSystem=binary';
            break;
          case 'bits':
            url += '&yUnitSystem=binary';
            break;
          case 'bps':
            url += '&yUnitSystem=si';
            break;
          case 'short':
            url += '&yUnitSystem=si';
            break;
          case 'none':
            url += '&yUnitSystem=none';
            break;
          }

          switch(scope.panel.nullPointMode) {
          case 'connected':
            url += '&lineMode=connected';
            break;
          case 'null':
            break; // graphite default lineMode
          case 'null as zero':
            url += "&drawNullAsZero=true";
            break;
          }

          url += scope.panel.steppedLine ? '&lineMode=staircase' : '';

          elem.html('<img src="' + url + '"></img>');
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
