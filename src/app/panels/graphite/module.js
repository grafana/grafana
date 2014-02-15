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

  module.controller('graphite', function($scope, $rootScope, filterSrv, datasourceSrv, $timeout, annotationsSrv) {

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

      datasource: null,

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
       * y_formats :: 'none','bytes','short', 'ms'
       */
      y_formats    : ['short', 'short'],
      /** @scratch /panels/histogram/5
       * grid object:: Min and max y-axis values
       * grid.min::: Minimum y-axis value
       * grid.ma1::: Maximum y-axis value
       */
      grid          : {
        max: null,
        min: 0,
        threshold1: null,
        threshold2: null,
        threshold1Color: 'rgba(216, 200, 27, 0.27)',
        threshold2Color: 'rgba(234, 112, 112, 0.22)'
      },

      annotate      : {
        enable      : false,
      },

      /** @scratch /panels/histogram/3
       * resolution:: If auto_int is true, shoot for this many bars.
       */
      resolution    : 100,

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
      legend: {
        show: true, // disable/enable legend
        values: false, // disable/enable legend values
        min: false,
        max: false,
        current: false,
        total: false,
        avg: false
      },
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
    _.defaults($scope.panel.tooltip, _d.tooltip);
    _.defaults($scope.panel.annotate, _d.annotate);
    _.defaults($scope.panel.grid, _d.grid);

    // backward compatible stuff
    if (_.isBoolean($scope.panel.legend)) {
      $scope.panel.legend = { show: $scope.panel.legend };
      _.defaults($scope.panel.legend, _d.legend);
    }

    if ($scope.panel.y_format) {
      $scope.panel.y_formats[0] = $scope.panel.y_format;
      delete $scope.panel.y_format;
    }
    if ($scope.panel.y2_format) {
      $scope.panel.y_formats[1] = $scope.panel.y2_format;
      delete $scope.panel.y2_format;
    }

    $scope.init = function() {
      // Hide view options by default
      $scope.fullscreen = false;
      $scope.options = false;
      $scope.editor = {index: 1};
      $scope.editorTabs = _.union(['General'],_.pluck($scope.panelMeta.fullEditorTabs,'title'));
      $scope.hiddenSeries = {};

      $scope.datasources = datasourceSrv.listOptions();
      $scope.datasource = datasourceSrv.get($scope.panel.datasource);

      // Always show the query if an alias isn't set. Users can set an alias if the query is too
      // long
      $scope.panel.tooltip.query_as_alias = true;

      $scope.get_data();
    };

    $scope.datasourceChanged = function() {
      $scope.datasource = datasourceSrv.get($scope.panel.datasource);
      $scope.get_data();
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

    $scope.updateTimeRange = function () {
      $scope.range = filterSrv.timeRange();
      $scope.rangeUnparsed = filterSrv.timeRange(false);

      $scope.interval = '10m';

      if ($scope.range) {
        $scope.interval = kbn.secondsToHms(
          kbn.calculate_interval($scope.range.from, $scope.range.to, $scope.panel.resolution, 0) / 1000
        );
      }
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
        range: $scope.rangeUnparsed,
        targets: $scope.panel.targets,
        format: $scope.panel.renderer === 'png' ? 'png' : 'json',
        maxDataPoints: $scope.panel.span * 50,
        datasource: $scope.panel.datasource
      };

      $scope.annotationsPromise = annotationsSrv.getAnnotations($scope.rangeUnparsed);

      return $scope.datasource.query(graphiteQuery)
        .then($scope.receiveGraphiteData)
        .then(null, function(err) {
          $scope.panel.error = err.message || "Graphite HTTP Request Error";
        });
    };

    $scope.receiveGraphiteData = function(results) {
      $scope.panelMeta.loading = false;
      $scope.legend = [];

      // png renderer returns just a url
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

        var seriesInfo = {
          alias: alias,
          color:  color,
          enable: true,
          yaxis: yaxis,
          y_format: $scope.panel.y_formats[yaxis - 1]
        };

        var series = new timeSeries.ZeroFilled({
          datapoints: targetData.datapoints,
          info: seriesInfo,
        });

        $scope.legend.push(seriesInfo);
        data.push(series);
      });

      $scope.annotationsPromise
        .then(function(annotations) {
          data.annotations = annotations;
          $scope.render(data);
        }, function() {
          $scope.render(data);
        });
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

    $scope.otherPanelInFullscreenMode = function() {
      return $rootScope.fullscreen && !$scope.fullscreen;
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

