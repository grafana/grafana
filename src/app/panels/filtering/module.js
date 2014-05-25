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

    $scope.remove = function(templateParameter) {
        $scope.filter.removeTemplateParameter(templateParameter);

        // TODO hkraemer: check if this makes sense like this
        if(!$rootScope.$$phase) {
            $rootScope.$apply();
        }
        $timeout(function(){
            $scope.dashboard.refresh();
        },0);
    };

    $scope.filterOptionSelected = function(templateParameter, option) {
      $scope.filter.templateOptionSelected(templateParameter, option);
      $scope.applyFilterToOtherFilters(templateParameter);
    };

    $scope.applyFilterToOtherFilters = function(updatedFilter) {
      _.each($scope.filter.templateParameters, function(templateParameter) {
        if (templateParameter === updatedFilter) {
          return;
        }
        if (templateParameter.query.indexOf(updatedFilter.name) !== -1) {
          $scope.applyFilter(templateParameter);
        }
      });
    };

    $scope.applyFilter = function(filter) {

      datasourceSrv.default.metricFindQuery($scope.filter, filter.query)
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

          $scope.filter.templateOptionSelected(filter, filter.options[0]);
        });
    };

    $scope.add = function() {
      $scope.filter.addTemplateParameter({
        type      : 'filter',
        name      : 'filter name',
        editing   : true,
        query     : 'metric.path.query.*',
      });
    };

    $scope.refresh = function() {
      $scope.dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

  });
});
