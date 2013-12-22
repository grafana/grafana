/** @scratch /panels/5
 * include::panels/histogram.asciidoc[]
 */

/** @scratch /panels/histogram/0
 * == Histogram
 * Status: *Stable*
 *
 * The histogram panel allow for the display of time charts. It includes several modes and tranformations
 * to display event counts, mean, min, max and total of numeric fields, and derivatives of counter
 * fields.
 *
 */
define([
  'angular',
  'app',
  'jquery',
  'underscore',
  'kbn',
  'moment',
  './timeSeries',
  './graphiteSrv',
  'rq',
  'jquery.flot',
  'jquery.flot.events',
  'jquery.flot.selection',
  'jquery.flot.time',
  'jquery.flot.byte',
  'jquery.flot.stack',
  'jquery.flot.stackpercent'
],
function (angular, app, $, _, kbn, moment, timeSeries, graphiteSrv, RQ) {

  'use strict';

  var module = angular.module('kibana.panels.graphite', []);
  app.useModule(module);

  module.controller('graphite', function($scope, $rootScope, filterSrv) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {
          title:'Targets',
          src:'app/panels/graphite/editor.html'
        },
        {
          title:'Axis labels',
          src:'app/panels/graphite/axisEditor.html'
        },
        {
          title:'Style',
          src:'app/panels/graphite/styleEditor.html'
        }
      ],
      status  : "Work in progress",
      description : " Graphite graphing panel"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/histogram/3
       * x-axis:: Show the x-axis
       */
      'x-axis'      : true,
      /** @scratch /panels/histogram/3
       * y-axis:: Show the y-axis
       */
      'y-axis'      : true,
      /** @scratch /panels/histogram/3
       * scale:: Scale the y-axis by this factor
       */
      scale         : 1,
      /** @scratch /panels/histogram/3
       * y_format:: 'none','bytes','short '
       */
      y_format    : 'none',
      /** @scratch /panels/histogram/5
       * grid object:: Min and max y-axis values
       * grid.min::: Minimum y-axis value
       * grid.max::: Maximum y-axis value
       */
      grid          : {
        max: null,
        min: 0
      },
      /** @scratch /panels/histogram/3
       * ==== Annotations
       * annotate object:: A query can be specified, the results of which will be displayed as markers on
       * the chart. For example, for noting code deploys.
       * annotate.enable::: Should annotations, aka markers, be shown?
       * annotate.query::: Lucene query_string syntax query to use for markers.
       * annotate.size::: Max number of markers to show
       * annotate.field::: Field from documents to show
       * annotate.sort::: Sort array in format [field,order], For example [`@timestamp',`desc']
       */
      annotate      : {
        enable      : false,
        query       : "*",
        size        : 20,
        field       : '_type',
        sort        : ['_score','desc']
      },
      /** @scratch /panels/histogram/3
       * ==== Interval options
       * auto_int:: Automatically scale intervals?
       */
      auto_int      : true,
      /** @scratch /panels/histogram/3
       * resolution:: If auto_int is true, shoot for this many bars.
       */
      resolution    : 100,
      /** @scratch /panels/histogram/3
       * interval:: If auto_int is set to false, use this as the interval.
       */
      interval      : '5m',
      /** @scratch /panels/histogram/3
       * interval:: Array of possible intervals in the *View* selector. Example [`auto',`1s',`5m',`3h']
       */
      intervals     : ['auto','1s','1m','5m','10m','30m','1h','3h','12h','1d','1w','1y'],
      /** @scratch /panels/histogram/3
       * ==== Drawing options
       * lines:: Show line chart
       */
      lines         : true,
      /** @scratch /panels/histogram/3
       * fill:: Area fill factor for line charts, 1-10
       */
      fill          : 0,
      /** @scratch /panels/histogram/3
       * linewidth:: Weight of lines in pixels
       */
      linewidth     : 1,
      /** @scratch /panels/histogram/3
       * points:: Show points on chart
       */
      points        : false,
      /** @scratch /panels/histogram/3
       * pointradius:: Size of points in pixels
       */
      pointradius   : 5,
      /** @scratch /panels/histogram/3
       * bars:: Show bars on chart
       */
      bars          : false,
      /** @scratch /panels/histogram/3
       * stack:: Stack multiple series
       */
      stack         : true,
      /** @scratch /panels/histogram/3
       * spyable:: Show inspect icon
       */
      spyable       : true,
      /** @scratch /panels/histogram/3
       * zoomlinks:: Show `Zoom Out' link
       */
      zoomlinks     : false,
      /** @scratch /panels/histogram/3
       * options:: Show quick view options section
       */
      options       : false,
      /** @scratch /panels/histogram/3
       * legend:: Display the legond
       */
      legend        : true,
      /** @scratch /panels/histogram/3
       * interactive:: Enable click-and-drag to zoom functionality
       */
      interactive   : true,
      /** @scratch /panels/histogram/3
       * legend_counts:: Show counts in legend
       */
      legend_counts : true,
      /** @scratch /panels/histogram/3
       * ==== Transformations
       * timezone:: Correct for browser timezone?. Valid values: browser, utc
       */
      timezone      : 'browser', // browser or utc
      /** @scratch /panels/histogram/3
       * percentage:: Show the y-axis as a percentage of the axis total. Only makes sense for multiple
       * queries
       */
      percentage    : false,
      /** @scratch /panels/histogram/3
       * zerofill:: Improves the accuracy of line charts at a small performance cost.
       */
      zerofill      : true,
      /** @scratch /panels/histogram/3
       * derivative:: Show each point on the x-axis as the change from the previous point
       */
      tooltip       : {
        value_type: 'cumulative',
        query_as_alias: true
      },
      targets: []
    };

    _.defaults($scope.panel,_d);
    _.defaults($scope.panel.tooltip,_d.tooltip);
    _.defaults($scope.panel.annotate,_d.annotate);
    _.defaults($scope.panel.grid,_d.grid);


    $scope.init = function() {
      $scope.openConfigureModal({preventDefault: function() {}, stopPropagation: function() {} });

      // Hide view options by default
      $scope.options = false;
      $scope.editor = {index: 1};

      // Always show the query if an alias isn't set. Users can set an alias if the query is too
      // long
      $scope.panel.tooltip.query_as_alias = true;

      $scope.get_data();

    };

    $scope.set_interval = function(interval) {
      if(interval !== 'auto') {
        $scope.panel.auto_int = false;
        $scope.panel.interval = interval;
      } else {
        $scope.panel.auto_int = true;
      }
    };

    $scope.typeAheadSource = function () {
      return ["test", "asd", "testing2"];
    };

    $scope.remove_panel_from_row = function(row, panel) {
      if ($scope.inEditMode) {
        $rootScope.$emit('fullEditMode', false);
      }
      else {
        $scope.$parent.remove_panel_from_row(row, panel);
      }
    };

    $scope.closeEditMode = function() {
      $rootScope.$emit('fullEditMode', false);
    };

    $scope.interval_label = function(interval) {
      return $scope.panel.auto_int && interval === $scope.panel.interval ? interval+" (auto)" : interval;
    };

    /**
     * The time range effecting the panel
     * @return {[type]} [description]
     */
    $scope.get_time_range = function () {
      var range = $scope.range = filterSrv.timeRange('last');
      return range;
    };

    $scope.get_interval = function () {
      var interval = $scope.panel.interval;
      var range;

      if ($scope.panel.auto_int) {
        range = $scope.get_time_range();
        if (range) {
          interval = kbn.secondsToHms(
            kbn.calculate_interval(range.from, range.to, $scope.panel.resolution, 0) / 1000
          );
        }
      }
      $scope.panel.interval = interval || '10m';
      return $scope.panel.interval;
    };

    $scope.colors = [
      "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0", //1
      "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477", //2
      "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0", //3
      "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93", //4
      "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7", //5
      "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B", //6
      "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"  //7
    ];

    /**
     * Fetch the data for a chunk of a queries results. Multiple segments occur when several indicies
     * need to be consulted (like timestamped logstash indicies)
     *
     * The results of this function are stored on the scope's data property. This property will be an
     * array of objects with the properties info, time_series, and hits. These objects are used in the
     * render_panel function to create the historgram.
     *
     */
    $scope.get_data = function() {
      delete $scope.panel.error;

      $scope.panelMeta.loading = true;

      var range = $scope.get_time_range();
      var interval = $scope.get_interval(range);

      var graphiteLoadOptions = {
        range: range,
        targets: $scope.panel.targets,
        maxDataPoints: $scope.panel.span * 50
      };

      var result = RQ.sequence([
        graphiteSrv.loadGraphiteData(graphiteLoadOptions),
        $scope.receiveGraphiteData(range, interval)
      ]);

      result(function (data, failure) {
        if (failure) {
          $scope.panel.error = 'Failed to do fetch graphite data: ' + failure;
          return;
        }

        $scope.panelMeta.loading = false;
        $scope.$apply();

        // Tell the histogram directive to render.
        $scope.$emit('render', data);
      });

    };

    $scope.receiveGraphiteData = function(range, interval) {

      return function receive_graphite_data_requestor(requestion, results) {
        $scope.legend = [];
        var data = [];

        if(results.length === 0 ) {
          requestion('no data in response from graphite');
        }

        //console.log('Data from graphite:', results);
        //console.log('nr datapoints from graphite: %d', results[0].datapoints.length);

        var tsOpts = {
          interval: interval,
          start_date: range && range.from,
          end_date: range && range.to,
          fill_style: 'no'
        };

        _.each(results, function(targetData) {
          var time_series = new timeSeries.ZeroFilled(tsOpts);

          _.each(targetData.datapoints, function(valueArray) {
            if (valueArray[0]) {
              time_series.addValue(valueArray[1] * 1000, valueArray[0]);
            }
          });

          var seriesInfo = {
            alias: targetData.target,
            color: $scope.colors[data.length],
            enable: true
          };

          $scope.legend.push(seriesInfo);

          data.push({
            info: seriesInfo,
            time_series: time_series
          });

        });

        requestion(data);
      };
    };

    $scope.add_target = function() {
      $scope.panel.targets.push({target: ''});
    };

    $scope.openConfigureModal = function($event) {
      $event.preventDefault();
      $event.stopPropagation();
      var oldHeight = $scope.row.height;
      $scope.row.height = 200;

      var closeEditMode = $rootScope.$on('fullEditMode', function(evt, enabled) {
        $scope.inEditMode = enabled;
        if (!enabled) {
          $scope.row.height = oldHeight;
          closeEditMode();
        }

        setImmediate(function() {
          $scope.$emit('render');
        });
      });

      $rootScope.$emit('fullEditMode', true);
    };

    // I really don't like this function, too much dom manip. Break out into directive?
    $scope.populate_modal = function(request) {
      $scope.inspector = angular.toJson(request,true);
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };

    $scope.render = function() {
      $scope.$emit('render');
    };

    $scope.setEditorTabs = function(panelMeta) {
      $scope.editorTabs = ['General'];
      if(!_.isUndefined(panelMeta.editorTabs)) {
        $scope.editorTabs =  _.union($scope.editorTabs,_.pluck(panelMeta.editorTabs,'title'));
      }
      return $scope.editorTabs;
    };

  });

  module.directive('histogramChart', function(filterSrv) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var data, plot;

        scope.$on('refresh',function() {
          scope.get_data();
        });

        // Receive render events
        scope.$on('render',function(event, d) {
          data = d || data;
          render_panel(data);
        });

        // Re-render if the window is resized
        angular.element(window).bind('resize', function() {
          render_panel(data);
        });

        // Function for rendering panel
        function render_panel(data) {
          // IE doesn't work without this
          elem.css({height:scope.panel.height || scope.row.height});

          // Populate from the query service
          try {
            _.each(data, function(series) {
              series.label = series.info.alias;
              series.color = series.info.color;
            });
          } catch(e) {return;}

          // Set barwidth based on specified interval
          var barwidth = kbn.interval_to_ms(scope.panel.interval);

          var stack = scope.panel.stack ? true : null;

          // Populate element
          try {
            var options = {
              legend: { show: false },
              series: {
                stackpercent: scope.panel.stack ? scope.panel.percentage : false,
                stack: scope.panel.percentage ? null : stack,
                lines:  {
                  show: scope.panel.lines,
                  // Silly, but fixes bug in stacked percentages
                  fill: scope.panel.fill === 0 ? 0.001 : scope.panel.fill/10,
                  lineWidth: scope.panel.linewidth,
                  steps: false
                },
                bars:   {
                  show: scope.panel.bars,
                  fill: 1,
                  barWidth: barwidth/1.5,
                  zero: false,
                  lineWidth: 0
                },
                points: {
                  show: scope.panel.points,
                  fill: 1,
                  fillColor: false,
                  radius: scope.panel.pointradius
                },
                shadowSize: 1
              },
              yaxis: {
                show: scope.panel['y-axis'],
                min: scope.panel.grid.min,
                max: scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.max
              },
              xaxis: {
                timezone: scope.panel.timezone,
                show: scope.panel['x-axis'],
                mode: "time",
                min: _.isUndefined(scope.range.from) ? null : scope.range.from.getTime(),
                max: _.isUndefined(scope.range.to) ? null : scope.range.to.getTime(),
                timeformat: time_format(scope.panel.interval),
                label: "Datetime",
                ticks: elem.width()/100
              },
              grid: {
                backgroundColor: null,
                borderWidth: 0,
                hoverable: true,
                color: '#c8c8c8'
              }
            };

            if(scope.panel.y_format === 'bytes') {
              options.yaxis.mode = "byte";
            }

            if(scope.panel.y_format === 'short') {
              options.yaxis.tickFormatter = function(val) {
                return kbn.shortFormat(val,0);
              };
            }

            if(scope.panel.annotate.enable) {
              options.events = {
                levels: 1,
                data: scope.annotations,
                types: {
                  'annotation': {
                    level: 1,
                    icon: {
                      icon: "icon-tag icon-flip-vertical",
                      size: 20,
                      color: "#222",
                      outline: "#bbb"
                    }
                  }
                }
                //xaxis: int    // the x axis to attach events to
              };
            }

            if(scope.panel.interactive) {
              options.selection = { mode: "x", color: '#666' };
            }

            // when rendering stacked bars, we need to ensure each point that has data is zero-filled
            // so that the stacking happens in the proper order
            var required_times = [];
            if (data.length > 1) {
              required_times = Array.prototype.concat.apply([], _.map(data, function (query) {
                return query.time_series.getOrderedTimes();
              }));
              required_times = _.uniq(required_times.sort(function (a, b) {
                // decending numeric sort
                return a-b;
              }), true);
            }

            for (var i = 0; i < data.length; i++) {
              var _d = data[i].time_series.getFlotPairs(required_times);
              data[i].data = _d;
            }

           /* var totalDataPoints = _.reduce(data, function(num, series) { return series.data.length + num; }, 0);
            console.log('Datapoints[0] count:', data[0].data.length);
            console.log('Datapoints.Total count:', totalDataPoints);*/

            plot = $.plot(elem, data, options);

            if (scope.panel.leftYAxisLabel) {
              elem.css('margin-left', '10px');
              var yaxisLabel = $("<div class='axisLabel yaxisLabel'></div>")
                .text(scope.panel.leftYAxisLabel)
                .appendTo(elem);

              yaxisLabel.css("margin-top", yaxisLabel.width() / 2 - 20);
            } else if (elem.css('margin-left')) {
              elem.css('margin-left', '');
            }

          } catch(e) {
            console.log(e);
            // Nothing to do here
          }
        }

        function time_format(interval) {
          var _int = kbn.interval_to_seconds(interval);
          if(_int >= 2628000) {
            return "%Y-%m";
          }
          if(_int >= 10000) {
            return "%Y-%m-%d";
          }
          if(_int >= 60) {
            return "%H:%M<br>%m-%d";
          }

          return "%H:%M:%S";
        }

        var $tooltip = $('<div>');

        elem.bind("plothover", function (event, pos, item) {
          var group, value, timestamp;
          if (item) {
            if (item.series.info.alias || scope.panel.tooltip.query_as_alias) {
              group = '<small style="font-size:0.9em;">' +
                '<i class="icon-circle" style="color:'+item.series.color+';"></i>' + ' ' +
                (item.series.info.alias || item.series.info.query)+
              '</small><br>';
            } else {
              group = kbn.query_color_dot(item.series.color, 15) + ' ';
            }
            value = (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') ?
              item.datapoint[1] - item.datapoint[2] :
              item.datapoint[1];
            if(scope.panel.y_format === 'bytes') {
              value = kbn.byteFormat(value,2);
            }
            if(scope.panel.y_format === 'short') {
              value = kbn.shortFormat(value,2);
            }
            timestamp = scope.panel.timezone === 'browser' ?
              moment(item.datapoint[0]).format('YYYY-MM-DD HH:mm:ss') :
              moment.utc(item.datapoint[0]).format('YYYY-MM-DD HH:mm:ss');
            $tooltip
              .html(
                group + value + " @ " + timestamp
              )
              .place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.detach();
          }
        });

        elem.bind("plotselected", function (event, ranges) {
          filterSrv.set({
            type  : 'time',
            from  : moment.utc(ranges.xaxis.from).toDate(),
            to    : moment.utc(ranges.xaxis.to).toDate(),
            field : scope.panel.time_field
          });
        });
      }
    };
  });

});

