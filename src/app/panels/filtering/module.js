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

  module.controller('filtering', function($scope, datasourceSrv, $rootScope, $timeout) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "graphite target filters"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
        // empty. Don't know if I need the function then.
    };

    $scope.remove = function( templateParameter ) {
        this.filter.removeTemplateParameter( templateParameter );
        
        // TODO hkraemer: check if this makes sense like this
        if(!$rootScope.$$phase) {
            $rootScope.$apply();
        }
        $timeout(function(){
            this.dashboard.refresh();
        },0);
    };

    $scope.filterOptionSelected = function( templateParameter, option ) {
      this.filter.templateOptionSelected(option);
      this.applyFilterToOtherFilters(templateParameter);
    };

    $scope.applyFilterToOtherFilters = function(updatedFilter) {
      _.each(this.filter.templateParameters, function( templateParameter ) {
        if (templateParameter === updatedFilter) {
          return;
        }
        if (templateParameter.query.indexOf(updatedFilter.name) !== -1) {
          $scope.applyFilter(templateParameter);
        }
      });
    };

    $scope.applyFilter = function(filter) {
      var query = this.filter.applyTemplateToTarget(filter.query);

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

          this.filter.templateOptionSelected(filter, filter.options[0]);
        });
    };

    $scope.add = function() {
      this.filter.addTemplateParameter({
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
