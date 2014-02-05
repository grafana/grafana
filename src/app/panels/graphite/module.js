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
  'jquery.flot',
  'jquery.flot.events',
  'jquery.flot.selection',
  'jquery.flot.time',
  'jquery.flot.byte',
  'jquery.flot.stack',
  'jquery.flot.stackpercent'
],
function (angular, app, $, _, kbn, moment, timeSeries) {

  'use strict';

  var module = angular.module('kibana.panels.graphite', []);
  app.useModule(module);

  module.controller('graphite', function($scope, $rootScope, filterSrv, graphiteSrv, $timeout) {

    $scope.panelMeta = {
      modals : [],
      editorTabs: [],

      fullEditorTabs : [
        {
          title:'Targets',
          src:'app/panels/graphite/editor.html'
        },
        {
          title:'Axes & Grid',
          src:'app/panels/graphite/axisEditor.html'
        },
        {
          title:'Display Styles',
          src:'app/panels/graphite/styleEditor.html'
        }
      ],

      menuItems: [
        { text: 'Edit',         click: 'openConfigureModal()' },
        { text: 'Fullscreen',   click: 'toggleFullscreen()' },
        { text: 'Duplicate',    click: 'duplicate()' },
        { text: 'Span', submenu: [
          { text: '1', click: 'updateColumnSpan(1)' },
          { text: '2', click: 'updateColumnSpan(2)' },
          { text: '3', click: 'updateColumnSpan(3)' },
          { text: '4', click: 'updateColumnSpan(4)' },
          { text: '5', click: 'updateColumnSpan(5)' },
          { text: '6', click: 'updateColumnSpan(6)' },
          { text: '7', click: 'updateColumnSpan(7)' },
          { text: '8', click: 'updateColumnSpan(8)' },
          { text: '9', click: 'updateColumnSpan(9)' },
          { text: '10', click: 'updateColumnSpan(10)' },
          { text: '11', click: 'updateColumnSpan(11)' },
          { text: '12', click: 'updateColumnSpan(12)' },
        ]},
        { text: 'Remove',          click: 'remove_panel_from_row(row, panel)' }
      ],

      status  : "Unstable",
      description : "Graphite graphing panel <br /><br />"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/histogram/3
       * renderer:: sets client side (flot) or native graphite png renderer (png)
       */
      renderer: 'flot',
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
      y2_format   : 'none',
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
       * legend:: Display the legond
       */
      legend        : true,
      /** @scratch /panels/histogram/3
       * ==== Transformations
      /** @scratch /panels/histogram/3
       * percentage:: Show the y-axis as a percentage of the axis total. Only makes sense for multiple
       * queries
       */
      percentage    : false,
      /** @scratch /panels/histogram/3
       * zerofill:: Improves the accuracy of line charts at a small performance cost.
       */
      zerofill      : true,

      nullPointMode : 'connected',

      steppedLine: false,

      tooltip       : {
        value_type: 'cumulative',
        query_as_alias: true
      },

      targets: [],

      aliasColors: {},
      aliasYAxis: {},
    };

    _.defaults($scope.panel,_d);
    _.defaults($scope.panel.tooltip,_d.tooltip);
    _.defaults($scope.panel.annotate,_d.annotate);
    _.defaults($scope.panel.grid,_d.grid);


    $scope.init = function() {
      // Hide view options by default
      $scope.fullscreen = false;
      $scope.options = false;
      $scope.editor = {index: 1};
      $scope.editorTabs = _.union(['General'],_.pluck($scope.panelMeta.fullEditorTabs,'title'));
      $scope.hiddenSeries = {};
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

    $scope.remove_panel_from_row = function(row, panel) {
      if ($scope.fullscreen) {
        $rootScope.$emit('panel-fullscreen-exit');
      }
      else {
        $scope.$parent.remove_panel_from_row(row, panel);
      }
    };

    $scope.removeTarget = function (target) {
      $scope.panel.targets = _.without($scope.panel.targets, target);
      $scope.get_data();
    };

    $scope.interval_label = function(interval) {
      return $scope.panel.auto_int && interval === $scope.panel.interval ? interval+" (auto)" : interval;
    };

    $scope.updateTimeRange = function () {
      var range = filterSrv.timeRange();
      var interval = filterSrv.timeRange();

      if ($scope.panel.auto_int) {
        if (range) {
          interval = kbn.secondsToHms(
            kbn.calculate_interval(range.from, range.to, $scope.panel.resolution, 0) / 1000
          );
        }
      }

      $scope.interval = $scope.panel.interval = interval || '10m';
      $scope.range = range;
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

      $scope.updateTimeRange();

      var graphiteQuery = {
        range: filterSrv.timeRange(false),
        targets: $scope.panel.targets,
        renderer: $scope.panel.renderer,
        maxDataPoints: $scope.panel.span * 50
      };

      return graphiteSrv.query(graphiteQuery)
        .then($scope.receiveGraphiteData)
        .then(null, function(err) {
          $scope.panel.error = err.message || "Graphite HTTP Request Error";
        });
    };

    $scope.receiveGraphiteData = function(results) {
      $scope.panelMeta.loading = false;
      $scope.legend = [];

      if (_.isString(results)) {
        $scope.render(results);
        return;
      }

      results = results.data;
      var data = [];

      _.each(results, function(targetData) {
        var alias = targetData.target;
        var color = $scope.panel.aliasColors[alias] || $scope.colors[data.length];
        var yaxis = $scope.panel.aliasYAxis[alias] || 1;

        var tsOpts = {
          interval: $scope.interval,
          start_date: $scope.range && $scope.range.from,
          end_date: $scope.range && $scope.range.to,
        };

        var time_series = new timeSeries.ZeroFilled(tsOpts);

        _.each(targetData.datapoints, function(valueArray) {
          if (valueArray[0] !== null) {
            time_series.addValue(valueArray[1] * 1000, valueArray[0]);
          }
        });

        var seriesInfo = {
          alias: alias,
          color:  color,
          enable: true,
          yaxis: yaxis,
        };

        $scope.legend.push(seriesInfo);

        data.push({
          info: seriesInfo,
          time_series: time_series,
        });

      });

      $scope.render(data);
    };

    $scope.add_target = function() {
      $scope.panel.targets.push({target: ''});
    };

    $scope.enterFullscreenMode = function(options) {
      var docHeight = $(window).height();
      var editHeight = Math.floor(docHeight * 0.3);
      var fullscreenHeight = Math.floor(docHeight * 0.7);
      var oldTimeRange = $scope.range;

      $scope.height = options.edit ? editHeight : fullscreenHeight;
      $scope.editMode = options.edit;

      if (!$scope.fullscreen) {
        var closeEditMode = $rootScope.$on('panel-fullscreen-exit', function() {
          $scope.editMode = false;
          $scope.fullscreen = false;
          delete $scope.height;

          closeEditMode();

          $timeout(function() {
            $scope.$emit('render');

            if (oldTimeRange !== $scope.range) {
              $scope.dashboard.refresh();
            }
          });
        });
      }

      $(window).scrollTop(0);

      $scope.fullscreen = true;
      $rootScope.$emit('panel-fullscreen-enter');

      $timeout($scope.render);
    };

    $scope.openConfigureModal = function() {
      if ($scope.editMode) {
        $rootScope.$emit('panel-fullscreen-exit');
        return;
      }

      $scope.enterFullscreenMode({edit: true});
    };

    $scope.render = function(data) {
      $scope.$emit('render', data);
    };

    $scope.changeSeriesColor = function(series, color) {
      series.color = color;
      $scope.panel.aliasColors[series.alias] = series.color;
      $scope.render();
    };

    $scope.duplicate = function(addToRow) {
      addToRow = addToRow || $scope.row;
      var currentRowSpan = $scope.rowSpan(addToRow);
      if (currentRowSpan <= 9) {
        addToRow.panels.push(angular.copy($scope.panel));
      }
      else {
        var rowsList = $scope.dashboard.current.rows;
        var rowIndex = _.indexOf(rowsList, addToRow);
        if (rowIndex === rowsList.length - 1) {
          var newRow = angular.copy($scope.row);
          newRow.panels = [];
          $scope.dashboard.current.rows.push(newRow);
          $scope.duplicate(newRow);
        }
        else {
          $scope.duplicate(rowsList[rowIndex+1]);
        }
      }
    };

    $scope.toggleFullscreen = function() {
      if ($scope.fullscreen && !$scope.editMode) {
        $rootScope.$emit('panel-fullscreen-exit');
        return;
      }

      $scope.enterFullscreenMode({edit: false});
    };

    $scope.toggleSeries = function(info) {
      if ($scope.hiddenSeries[info.alias]) {
        delete $scope.hiddenSeries[info.alias];
      }
      else {
        $scope.hiddenSeries[info.alias] = true;
      }

      $scope.$emit('toggleLegend', info.alias);
    };

    $scope.toggleYAxis = function(info) {
      info.yaxis = info.yaxis === 2 ? 1 : 2;
      $scope.panel.aliasYAxis[info.alias] = info.yaxis;
      $scope.render();
    };

    $scope.toggleGridMinMax = function(key) {
      $scope.panel.grid[key] = _.toggle($scope.panel.grid[key], null, 0);
      $scope.render();
    };

    $scope.updateColumnSpan = function(span) {
      $scope.panel.span = span;
      $timeout($scope.render);
    };

  });


});

