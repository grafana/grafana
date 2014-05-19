/*

  ## filtering

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.filtering', []);
  app.useModule(module);

  module.controller('filtering', function($scope, filterSrv, datasourceSrv, $rootScope, dashboard, $q) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "graphite target filters"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.filterSrv = filterSrv;
      var me = $scope;
      $rootScope.$on('datasourceUpdated', function(event) {
        me.refreshFilters();
        // Prevent the default dashboard refresh, since we'll call "refresh" ourselves once
        // the filters have been updated.
        event.preventDefault();
      });
    };

    $scope.remove = function(filter) {
      filterSrv.remove(filter);
    };

    $scope.filterOptionSelected = function(filter, option) {
      filterSrv.filterOptionSelected(filter, option);
      $scope.applyFilterToOtherFilters(filter);
    };

    $scope.applyFilterToOtherFilters = function(updatedFilter) {
      _.each(filterSrv.list, function(filter) {
        if (filter === updatedFilter) {
          return;
        }
        if (filter.query.indexOf(updatedFilter.name) !== -1) {
          $scope.applyFilter(filter);
        }
      });
    };

    $scope.applyFilter = function(filter) {
      $scope.refreshFilter(filter, true);
    };

    /**
     * Refresh the options for the given filter.
     * @param filter the filter
     * @param selectFirst if true, set the first option in the filter as the selected option
     * @return the promise for the async refresh action
     */
    $scope.refreshFilter = function(filter, selectFirst) {
      var query = filterSrv.applyFilterToTarget(filter.query);
      return datasourceSrv.default.metricFindQuery(query)
        .then(function (results) {
          filter.editing=undefined;
          var originalOptions = filter.options;
          var allExprChanged = false;
          filter.options = _.map(results, function(node) {
            var value = node.text;
            try {
              if (filter.regex && filter.regex.trim().length > 0) {
                var match = new RegExp(filter.regex).exec(value);
                if (match) {
                  value = match[0];
                } else {
                  return null;
                }
              }
            } catch (e) {
              console.error("Regex error: "+e, e);
            }
            return { text: value, value: value };
          });

          // Return sorted, unique options.
          var getLowerCaseText = function(option) {
            return option.text.toLowerCase();
          };
          filter.options = _.uniq(_.sortBy(_.without(filter.options, null), getLowerCaseText), true, getLowerCaseText);

          if (filter.includeAll) {
            var allExpr = '{';
            _.each(filter.options, function(option) {
              allExpr += option.text + ',';
            });
            allExpr = allExpr.substring(0, allExpr.length - 1) + '}';
            filter.options.unshift({text: 'All', value: allExpr});

            if (originalOptions && originalOptions.length > 0 && originalOptions[0].text === 'All'
              && originalOptions[0].value !== allExpr) {
              allExprChanged = true;
            }
          }

          if (selectFirst) {
            filterSrv.filterOptionSelected(filter, filter.options[0]);
          } else if (filter.includeAll && (filter.current.text === 'All') && allExprChanged) {
            // If the selected option is "All" and the All expression has changed, re-select it to re-query the chart data.
            filterSrv.filterOptionSelected(filter, filter.options[0]);
          }
        });
    };

    /**
     * Refresh the options for all the filters in the dashboard
     */
    $scope.refreshFilters = function() {
      var refreshPromises = _.map(filterSrv.list, function(filter) {
        return $scope.refreshFilter(filter, false);
      });

      // Reload the dashboard once all the filters have the updated options.
      $q.all(refreshPromises).then(function() {
        dashboard.refresh();
      });
    };

    $scope.add = function() {
      filterSrv.add({
        type      : 'filter',
        name      : 'filter name',
        editing   : true,
        query     : 'metric.path.query.*',
      });
    };

    $scope.refresh = function() {
      dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

  });
});