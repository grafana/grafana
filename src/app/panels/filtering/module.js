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

  module.controller('filtering', function($scope, filterSrv, datasourceSrv, $rootScope, dashboard) {

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
      $rootScope.$on('datasourceUpdated', $scope.refreshFilters);
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
     */
    $scope.refreshFilter = function(filter, selectFirst) {
      var query = filterSrv.applyFilterToTarget(filter.query);
      datasourceSrv.default.metricFindQuery(query)
        .then(function (results) {
          filter.editing=undefined;
          var originalOptions = filter.options;
          var allExprChanged = false;
          filter.options = _.map(results, function(node) {
            return { text: node.text, value: node.text };
          });

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
      _.each(filterSrv.list, function(filter) {
        $scope.refreshFilter(filter, false);
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