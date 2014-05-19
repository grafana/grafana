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

  module.controller('filtering', function($scope, datasourceSrv, $rootScope, $timeout, dashboard) {

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
      console.log( "Filtering panel " + $scope.dashboard );
      $scope.filterSrv.init( $scope.dashboard );
    };

    $scope.remove = function(filter) {
        this.filter.removeFilter(filter);
        
        // TODO hkraemer: check if this makes sense like this
        if(!$rootScope.$$phase) {
            $rootScope.$apply();
        }
        $timeout(function(){
            this.dashboard.refresh();
        },0);
    };

    $scope.filterOptionSelected = function(filter, option) {
      this.filter.filterOptionSelected(option);
      this.applyFilterToOtherFilters(filter);
    };

    $scope.applyFilterToOtherFilters = function(updatedFilter) {
      _.each(this.filter.list, function(filter) {
        if (filter === updatedFilter) {
          return;
        }
        if (filter.query.indexOf(updatedFilter.name) !== -1) {
          $scope.applyFilter(filter);
        }
      });
    };

    $scope.applyFilter = function(filter) {
      var query = this.filter.applyFilterToTarget(filter.query);

      datasourceSrv.default.metricFindQuery($scope, query)
        .then(function (results) {
          filter.editing=undefined;
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
          }

          this.filterSrv.filterOptionSelected(filter, filter.options[0]);
        });
    };

    $scope.add = function() {
      this.filter.add({
        type      : 'filter',
        name      : 'filter name',
        editing   : true,
        query     : 'metric.path.query.*',
      });
    };

    $scope.refresh = function() {
      this.dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

  });
});
