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

  app.directive('focusMe', function() {
    return {
      link: function(scope, element, attrs) {
        scope.$watch(attrs.focusMe, function(value) {
          if(value === true) {
            element[0].focus();
          }
        });
      }
    };
  });

  module.controller('filtering', function($scope, datasourceSrv, $rootScope, $timeout, $q) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "graphite target filters"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);
    _.each($scope.filter.templateParameters, function(param) { param.picking = false; });

    $scope.init = function() {
      // empty. Don't know if I need the function then.
    };

    $scope.remove = function(templateParameter) {
      $scope.filter.removeTemplateParameter(templateParameter);
    };

    $scope.filterOptionSelected = function(templateParameter, selectedFilter, recursive) {
      var filter = _.find(templateParameter.options, function(opt) { return opt.text === selectedFilter; });

      if (filter != null) {
        templateParameter.current = filter;

        $scope.filter.updateTemplateData();

        return $scope.applyFilterToOtherFilters(templateParameter)
          .then(function() {
            // only refresh in the outermost call
            if (!recursive) {
              $scope.dashboard.refresh();
            }
          });
      }
    };

    $scope.applyFilterToOtherFilters = function(updatedTemplatedParam) {
      cachedFilters = {};
      var promises = _.map($scope.filter.templateParameters, function(templateParam) {
        if (templateParam === updatedTemplatedParam) {
          return;
        }
        if (templateParam.query.indexOf(updatedTemplatedParam.name) !== -1) {
          return $scope.applyFilter(templateParam);
        }
      });

      return $q.all(promises);
    };

    $scope.applyFilter = function(templateParam) {
      return datasourceSrv.default.metricFindQuery($scope.filter, templateParam.query)
        .then(function (results) {
          templateParam.editing = undefined;
          templateParam.options = _.map(results, function(node) {
            return { text: node.text, value: node.text };
          });

          if (templateParam.includeAll) {
            var allExpr = '{';
            _.each(templateParam.options, function(option) {
              allExpr += option.text + ',';
            });
            allExpr = allExpr.substring(0, allExpr.length - 1) + '}';
            templateParam.options.unshift({text: 'All', value: allExpr});
          }

          // if parameter has current value
          // if it exists in options array keep value
          if (templateParam.current) {
            var currentExists = _.findWhere(templateParam.options, { value: templateParam.current.value });
            if (currentExists) {
              return $scope.filterOptionSelected(templateParam, templateParam.current.text, true);
            }
          }

          return $scope.filterOptionSelected(templateParam, templateParam.options[0].text, true);
        });
    };

    var cachedFilters = {};
    $scope.textFilter = function(filterIndex) {
      if (!cachedFilters[filterIndex]) {
        var opts = $scope.filter.templateParameters[filterIndex].options;
        cachedFilters[filterIndex] = _.map(opts, function(option) { return option.text;});
      }
      return cachedFilters[filterIndex];
    };

    $scope.filterPick = function(filter) {
      filter.picking=!filter.picking;
    };

    $scope.filterApply = function(filter, selectedFilter) {
      $scope.filterOptionSelected(filter, selectedFilter);
      $scope.filterPick(filter);
    };

    $scope.add = function() {
      $scope.filter.addTemplateParameter({
        type      : 'filter',
        name      : 'filter name',
        editing   : true,
        query     : 'metric.path.query.*',
      });
    };

  });
});
