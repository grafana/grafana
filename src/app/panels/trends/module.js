/** @scratch /panels/5
 * include::panels/trends.asciidoc[]
 */

/** @scratch /panels/trends/0
 * == trends
 * Status: *Beta*
 *
 * A stock-ticker style representation of how queries are moving over time. For example, if the
 * time is 1:10pm, your time picker was set to "Last 10m", and the "Time Ago" parameter was set to
 * "1h", the panel would show how much the query results have changed since 12:00-12:10pm
 *
 */
define([
  'angular',
  'app',
  'underscore',
  'kbn'
],
function (angular, app, _, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.trends', []);
  app.useModule(module);

  module.controller('trends', function($scope, kbnIndex, querySrv, dashboard, filterSrv) {

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
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Beta",
      description : "A stock-ticker style representation of how queries are moving over time. "+
      "For example, if the time is 1:10pm, your time picker was set to \"Last 10m\", and the \"Time "+
      "Ago\" parameter was set to '1h', the panel would show how much the query results have changed"+
      " since 12:00-12:10pm"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/trends/5
       * === Parameters
       *
       * ago:: A date math formatted string describing the relative time period to compare the
       * queries to.
       */
      ago     : '1d',
      /** @scratch /panels/trends/5
       * arrangement:: `horizontal' or `vertical'
       */
      arrangement : 'vertical',
      /** @scratch /panels/trends/5
       * spyable:: Set to false to disable the inspect icon
       */
      spyable: true,
      /** @scratch /panels/trends/5
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
      style   : { "font-size": '14pt'},
    };
    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh', function(){$scope.get_data();});

      $scope.get_data();
    };

    $scope.get_data = function(segment,query_id) {
      delete $scope.panel.error;
      $scope.panelMeta.loading = true;

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      } else {
        $scope.index = segment > 0 ? $scope.index : dashboard.indices;
      }

      // Determine a time field
      var timeField = _.uniq(_.pluck(filterSrv.getByType('time'),'field'));
      if(timeField.length > 1) {
        $scope.panel.error = "Time field must be consistent amongst time filters";
        return;
      } else if(timeField.length === 0) {
        $scope.panel.error = "A time filter must exist for this panel to function";
        return;
      } else {
        timeField = timeField[0];
      }

      // This logic can be simplifie greatly with the new kbn.parseDate
      $scope.time = filterSrv.timeRange('last');
      $scope.old_time = {
        from : new Date($scope.time.from.getTime() - kbn.interval_to_ms($scope.panel.ago)),
        to   : new Date($scope.time.to.getTime() - kbn.interval_to_ms($scope.panel.ago))
      };

      var _segment = _.isUndefined(segment) ? 0 : segment;
      var request = $scope.ejs.Request();
      var _ids_without_time = _.difference(filterSrv.ids,filterSrv.idsByType('time'));

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      var queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // Build the question part of the query
      _.each(queries, function(query) {
        var q = $scope.ejs.FilteredQuery(
          querySrv.toEjsObj(query),
          filterSrv.getBoolFilter(_ids_without_time).must(
            $scope.ejs.RangeFilter(timeField)
            .from($scope.time.from)
            .to($scope.time.to)
          ));

        request = request
          .facet($scope.ejs.QueryFacet(query.id)
            .query(q)
          ).size(0);
      });


      // And again for the old time period
      _.each(queries, function(query) {
        var q = $scope.ejs.FilteredQuery(
          querySrv.toEjsObj(query),
          filterSrv.getBoolFilter(_ids_without_time).must(
            $scope.ejs.RangeFilter(timeField)
            .from($scope.old_time.from)
            .to($scope.old_time.to)
          ));
        request = request
          .facet($scope.ejs.QueryFacet("old_"+query.id)
            .query(q)
          ).size(0);
      });


      // Populate the inspector panel
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);

      // If we're on the first segment we need to get our indices
      if (_segment === 0) {
        kbnIndex.indices(
          $scope.old_time.from,
          $scope.old_time.to,
          dashboard.current.index.pattern,
          dashboard.current.index.interval
        ).then(function (p) {
          $scope.index = _.union(p,$scope.index);
          request = request.indices($scope.index[_segment]);
          process_results(request.doSearch(),_segment,query_id);
        });
      } else {
        process_results(request.indices($scope.index[_segment]).doSearch(),_segment,query_id);
      }

    };

    // Populate scope when we have results
    var process_results = function(results,_segment,query_id) {
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        if(_segment === 0) {
          $scope.hits = {};
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
          var i = 0;
          var queries = querySrv.getQueryObjs($scope.panel.queries.ids);

          _.each(queries, function(query) {
            var n = results.facets[query.id].count;
            var o = results.facets['old_'+query.id].count;

            var hits = {
              new : _.isUndefined($scope.data[i]) || _segment === 0 ? n : $scope.data[i].hits.new+n,
              old : _.isUndefined($scope.data[i]) || _segment === 0 ? o : $scope.data[i].hits.old+o
            };

            $scope.hits.new += n;
            $scope.hits.old += o;

            var percent = percentage(hits.old,hits.new) == null ?
              '?' : Math.round(percentage(hits.old,hits.new)*100)/100;
            // Create series
            $scope.data[i] = {
              info: query,
              hits: {
                new : hits.new,
                old : hits.old
              },
              percent: percent
            };

            i++;
          });
          $scope.$emit('render');
          if(_segment < $scope.index.length-1) {
            $scope.get_data(_segment+1,query_id);
          } else {
            $scope.trends = $scope.data;
          }
        }
      });
    };

    function percentage(x,y) {
      return x === 0 ? null : 100*(y-x)/x;
    }

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

  });
});