define([
  'angular',
  'lodash',
  'kbn',
  'store'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('templateValuesSrv', function($q, $rootScope, datasourceSrv, $routeParams, templateSrv) {
    var self = this;

    this.filterOptionSelected = function(templateParameter, option, recursive) {
      templateParameter.current = option;

      templateSrv.updateTemplateData();

      return this.applyFilterToOtherFilters(templateParameter)
        .then(function() {
          if (!recursive) {
            $rootScope.$broadcast('refresh');
          }
        });
    };

    this.applyFilterToOtherFilters = function(updatedTemplatedParam) {
      var promises = _.map(self.templateParameters, function(templateParam) {
        if (templateParam === updatedTemplatedParam) {
          return;
        }
        if (templateParam.query.indexOf('[[' + updatedTemplatedParam.name + ']]') !== -1) {
          return self.applyFilter(templateParam);
        }
      });

      return $q.all(promises);
    };

    this.applyFilter = function(templateParam) {
      return datasourceSrv.default.metricFindQuery(templateParam.query)
        .then(function (results) {
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
              return self.filterOptionSelected(templateParam, templateParam.current, true);
            }
          }

          return self.filterOptionSelected(templateParam, templateParam.options[0], true);
        });
    };

  });

});
