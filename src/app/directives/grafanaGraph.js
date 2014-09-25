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

  module.directive('grafanaGraph', function($rootScope, timeSrv) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var data, annotations;
        var dashboard = scope.dashboard;
        var legendSideLastValue = null;

        scope.$on('refresh',function() {
          scope.get_data();
        });

        scope.$on('toggleLegend', function() {
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

          if (elem.width() === 0) {
            return;
          }
        }

        function updateLegendValues(plot) {
          var yaxis = plot.getYAxes();
          console.log('drawSeries', yaxis);

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            var formater = kbn.formatFunctions[scope.panel.y_formats[series.yaxis - 1]];
            series.updateLegendValues(formater, yaxis[series.yaxis - 1].tickDecimals);
          }

        }

        // Function for rendering panel
        function render_panel() {
          if (shouldAbortRender()) {
            return;
          }

          var panel = scope.panel;
          var stack = panel.stack ? true : null;

          // Populate element
          var options = {
            hooks: { draw: [updateLegendValues] },
            legend: { show: false },
            series: {
              stackpercent: panel.stack ? panel.percentage : false,
              stack: panel.percentage ? null : stack,
              lines:  {
                show: panel.lines,
                zero: false,
                fill: translateFillOption(panel.fill),
                lineWidth: panel.linewidth,
                steps: panel.steppedLine
              },
              bars:   {
                show: panel.bars,
                fill: 1,
                barWidth: 1,
                zero: false,
                lineWidth: 0
              },
              points: {
                show: panel.points,
                fill: 1,
                fillColor: false,
                radius: panel.pointradius
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
            },
            crosshair: {
              mode: panel.tooltip.shared ? "x" : null
            }
          };

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.applySeriesOverrides(panel.seriesOverrides);
            series.data = series.getFlotPairs(panel.nullPointMode, panel.y_formats);
            // if hidden remove points and disable stack
            if (scope.hiddenSeries[series.info.alias]) {
              series.data = [];
              series.stack = false;
            }
          }

          if (data.length && data[0].info.timeStep) {
            options.series.bars.barWidth = data[0].info.timeStep / 1.5;
          }

          addTimeAxis(options);
          addGridThresholds(options, panel);
          addAnnotations(options);
          configureAxisOptions(data, options);

          var sortedSeries = _.sortBy(data, function(series) { return series.zindex; });

          function callPlot() {
            try {
              elem.flot=$.plot(elem, sortedSeries, options);
            } catch (e) {
              console.log('flotcharts error', e);
            }

            addAxisLabels();
          }

          if (shouldDelayDraw(panel)) {
            setTimeout(callPlot, 50);
            legendSideLastValue = panel.legend.rightSide;
          }
          else {
            callPlot();
          }
        }

        function translateFillOption(fill) {
          return fill === 0 ? 0.001 : fill/10;
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

        function addGridThresholds(options, panel) {
          if (panel.grid.threshold1) {
            var limit1 = panel.grid.thresholdLine ? panel.grid.threshold1 : (panel.grid.threshold2 || null);
            options.grid.markings.push({
              yaxis: { from: panel.grid.threshold1, to: limit1 },
              color: panel.grid.threshold1Color
            });

            if (panel.grid.threshold2) {
              var limit2;
              if (panel.grid.thresholdLine) {
                limit2 = panel.grid.threshold2;
              } else {
                limit2 = panel.grid.threshold1 > panel.grid.threshold2 ?  -Infinity : +Infinity;
              }
              options.grid.markings.push({
                yaxis: { from: panel.grid.threshold2, to: limit2 },
                color: panel.grid.threshold2Color
              });
            }
          }
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
          axis.tickFormatter = function(val, axis) {
            return kbn.formatFunctions[format](val, axis.tickDecimals);
          };
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

        //this event will erase tooltip and crosshair once leaved the graph
        elem.mouseleave(function () {
          console.log('onmouse out:');
          if(scope.panel.tooltip.shared) {
            $tooltip.detach();
            elem.flot.clearCrosshair();
          }
        });

        elem.bind("plothover", function (event, pos, item) {
          var group, value, timestamp, seriesInfo, format, i, j, s, s_final;

          //if tooltip shared we'll show a crosshair and will look for X and all Y series values
          //else we will take from item.
          if(scope.panel.tooltip.shared){
            //check if all series has same length if so, only one x index will
            //be checked and only for exact timestamp values
            var l = [];
            var series;
            for (i = 0; i < data.length; ++i) {
              series = data[i];
              l.push(series.data.length);
            }
            //if all series has the same length it is because of they share time axis
            if(_.uniq(l).length === 1) {
              s='';
              series = data[0];
              for(j=0;j<series.data.length;j++) {
                if(series.data[j][0] > pos.x){
                  break;
                }
              }
              j--; //we take previous value in time.
              //now we know the current X (j) position for X and Y values
              timestamp = dashboard.formatDate(series.data[j][0]);
              var last_value=0; //needed for stacked values
              for (i = data.length-1; i >= 0; --i) {
                //stacked values should be added in reverse order
                series = data[i];
                seriesInfo = series.info;
                format = scope.panel.y_formats[seriesInfo.yaxis - 1];
                if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
                  value = series.data[j][1];
                } else {
                  last_value+=series.data[j][1];
                  value = last_value;
                }
                value = kbn.getFormatFunction(format, 2)(value,series.yaxis);
                if (seriesInfo.alias) {
                  group = '<i class="icon-circle" style="color:'+series.color+';"></i>' +
                          ' ' +  seriesInfo.alias;
                } else {
                  group = kbn.query_color_dot(series.color, 15) + ' ';
                }
                //pre-pending new values
                s_final= group+ ": "+value +'<br>'+ s;
                s=s_final;
              }

              $tooltip.html('<small style="font-size:0.7em;">Time@ <b>'+
                            timestamp + '</b><br>' + s + '</small>').place_tt(pos.pageX, pos.pageY);
              return;
            }else {
              console.log('WARNING: tootltip shared can not be shown becouse of from '
                          +data.length+' series has different length '+_.uniq(l));
              $tooltip.detach();
            }
          }
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

            value = kbn.getFormatFunction(format, 2)(value, item.series.yaxis);
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
            timeSrv.setTime({
              from  : moment.utc(ranges.xaxis.from).toDate(),
              to    : moment.utc(ranges.xaxis.to).toDate(),
            });
          });
        });
      }
    };
  });

});
