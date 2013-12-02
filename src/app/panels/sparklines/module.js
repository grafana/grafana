/** @scratch /panels/5
 * include::panels/sparklines.asciidoc[]
 */

/** @scratch /panels/sparklines/0
 * == Sparklines
 * Status: *Experimental*
 *
 * The sparklines panel shows tiny time charts. The purpose of these is not to give an exact value,
 * but rather to show the shape of the time series in a compact manner
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
  'jquery.flot.time'
],
function (angular, app, $, _, kbn, moment, timeSeries) {

  'use strict';

  var module = angular.module('kibana.panels.sparklines', []);
  app.useModule(module);

  module.controller('sparklines', function($scope, querySrv, dashboard, filterSrv) {
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
          title:'Queries',
          src:'app/partials/querySelect.html'
        }
      ],
      status  : "Experimental",
      description : "Sparklines are tiny, simple, time series charts, shown seperately. Because "+
        "sparklines are unclutted by grids, axis markers and colors, they are perfect for spotting"+
        " change in a series"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/sparklines/3
       * === Parameters
       * mode:: Value to use for the y-axis. For all modes other than count, +value_field+ must be
       * defined. Possible values: count, mean, max, min, total.
       */
      mode          : 'count',
      /** @scratch /panels/sparklines/3
       * time_field:: x-axis field. This must be defined as a date type in Elasticsearch.
       */
      time_field    : '@timestamp',
      /** @scratch /panels/sparklines/3
       * value_field:: y-axis field if +mode+ is set to mean, max, min or total. Must be numeric.
       */
      value_field   : null,
      /** @scratch /panels/sparklines/3
       * interval:: Sparkline intervals are computed automatically as long as there is a time filter
       * present. In the absence of a time filter, use this interval.
       */
      interval      : '5m',
      /** @scratch /panels/sparklines/3
       * spyable:: Show inspect icon
       */
      spyable       : true,
      /** @scratch /panels/sparklines/5
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {

      $scope.$on('refresh',function(){
        $scope.get_data();
      });

      $scope.get_data();

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
      var interval = $scope.panel.interval,
                      range;
      range = $scope.get_time_range();
      if (range) {
        interval = kbn.secondsToHms(
          kbn.calculate_interval(range.from, range.to, 10, 0) / 1000
        );
      }
      $scope.panel.interval = interval || '10m';
      return $scope.panel.interval;
    };

    /**
     * Fetch the data for a chunk of a queries results. Multiple segments occur when several indicies
     * need to be consulted (like timestamped logstash indicies)
     *
     * The results of this function are stored on the scope's data property. This property will be an
     * array of objects with the properties info, time_series, and hits. These objects are used in the
     * render_panel function to create the historgram.
     *
     * @param {number} segment   The segment count, (0 based)
     * @param {number} query_id  The id of the query, generated on the first run and passed back when
     *                            this call is made recursively for more segments
     */
    $scope.get_data = function(segment, query_id) {
      var
        _range,
        _interval,
        request,
        queries,
        results;

      if (_.isUndefined(segment)) {
        segment = 0;
      }
      delete $scope.panel.error;

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }
      _range = $scope.get_time_range();
      _interval = $scope.get_interval(_range);

      $scope.panelMeta.loading = true;
      request = $scope.ejs.Request().indices(dashboard.indices[segment]);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);

      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // Build the query
      _.each(queries, function(q) {
        var query = $scope.ejs.FilteredQuery(
          querySrv.toEjsObj(q),
          filterSrv.getBoolFilter(filterSrv.ids)
        );

        var facet = $scope.ejs.DateHistogramFacet(q.id);

        if($scope.panel.mode === 'count') {
          facet = facet.field($scope.panel.time_field).global(true);
        } else {
          if(_.isNull($scope.panel.value_field)) {
            $scope.panel.error = "In " + $scope.panel.mode + " mode a field must be specified";
            return;
          }
          facet = facet.keyField($scope.panel.time_field).valueField($scope.panel.value_field);
        }
        facet = facet.interval(_interval).facetFilter($scope.ejs.QueryFilter(query));
        request = request.facet(facet)
          .size(0);
      });

      // Populate the inspector panel
      $scope.populate_modal(request);

      // Then run it
      results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {

        $scope.panelMeta.loading = false;
        if(segment === 0) {
          $scope.hits = 0;
          $scope.data = [];
          query_id = $scope.query_id = new Date().getTime();
        }

        // Check for error and abort if found
        if(!(_.isUndefined(results.error))) {
          $scope.panel.error = $scope.parse_error(results.error);
          return;
        }

        // Make sure we're still on the same query/queries
        if($scope.query_id === query_id) {

          var i = 0,
            time_series,
            hits;

          _.each(queries, function(q) {
            var query_results = results.facets[q.id];
            // we need to initialize the data variable on the first run,
            // and when we are working on the first segment of the data.
            if(_.isUndefined($scope.data[i]) || segment === 0) {
              var tsOpts = {
                interval: _interval,
                start_date: _range && _range.from,
                end_date: _range && _range.to,
                fill_style: 'minimal'
              };
              time_series = new timeSeries.ZeroFilled(tsOpts);
              hits = 0;
            } else {
              time_series = $scope.data[i].time_series;
              hits = $scope.data[i].hits;
            }

            // push each entry into the time series, while incrementing counters
            _.each(query_results.entries, function(entry) {
              time_series.addValue(entry.time, entry[$scope.panel.mode]);
              hits += entry.count; // The series level hits counter
              $scope.hits += entry.count; // Entire dataset level hits counter
            });
            $scope.data[i] = {
              info: q,
              range: $scope.range,
              time_series: time_series,
              hits: hits
            };

            i++;
          });

          // If we still have segments left, get them
          if(segment < dashboard.indices.length-1) {
            $scope.get_data(segment+1,query_id);
          }
        }
      });
    };

    // I really don't like this function, too much dom manip. Break out into directive?
    $scope.populate_modal = function(request) {
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
    };

  });

  module.directive('sparklinesChart', function() {
    return {
      restrict: 'A',
      scope: {
        series: '=',
        panel: '='
      },
      template: '<div></div>',
      link: function(scope, elem) {

        // Receive render events
        scope.$watch('series',function(){
          render_panel();
        });

        // Re-render if the window is resized
        angular.element(window).bind('resize', function(){
          render_panel();
        });

        var derivative = function(series) {
          return _.map(series, function(p,i) {
            var _v;
            if(i === 0 || p[1] === null) {
              _v = [p[0],null];
            } else {
              _v = series[i-1][1] === null ? [p[0],null] : [p[0],p[1]-(series[i-1][1])];
            }
            return _v;
          });
        };

        // Function for rendering panel
        function render_panel() {
          // IE doesn't work without this
          elem.css({height:"30px",width:"100px"});

          // Populate element
          //try {
          var options = {
            legend: { show: false },
            series: {
              lines:  {
                show: true,
                // Silly, but fixes bug in stacked percentages
                fill: 0,
                lineWidth: 2,
                steps: false
              },
              points: { radius:2 },
              shadowSize: 1
            },
            yaxis: {
              show: false
            },
            xaxis: {
              show: false,
              mode: "time",
              min: _.isUndefined(scope.series.range.from) ? null : scope.series.range.from.getTime(),
              max: _.isUndefined(scope.series.range.to) ? null : scope.series.range.to.getTime()
            },
            grid: {
              hoverable: false,
              show: false
            }
          };
          // when rendering stacked bars, we need to ensure each point that has data is zero-filled
          // so that the stacking happens in the proper order
          var required_times = [];
          required_times = scope.series.time_series.getOrderedTimes();
          required_times = _.uniq(required_times.sort(function (a, b) {
            // decending numeric sort
            return a-b;
          }), true);

          var _d = {
            data  : scope.panel.derivative ?
             derivative(scope.series.time_series.getFlotPairs(required_times)) :
             scope.series.time_series.getFlotPairs(required_times),
            label : scope.series.info.alias,
            color : elem.css('color'),
          };

          $.plot(elem, [_d], options);

          //} catch(e) {
          //  console.log(e);
          //}
        }

        var $tooltip = $('<div>');
        elem.bind("plothover", function (event, pos, item) {
          if (item) {
            $tooltip
              .html(
                item.datapoint[1] + " @ " + moment(item.datapoint[0]).format('YYYY-MM-DD HH:mm:ss')
              )
              .place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.detach();
          }
        });
      }
    };
  });

});
