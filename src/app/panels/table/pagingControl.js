define([
  'angular',
  'lodash'
],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('grafanaTablePager', function($rootScope, timeSrv, $compile) {
      return {
        restrict: 'A',
        templateUrl: 'app/panels/table/pagingControl.html',
        link: function(scope, elem) {
          scope.arrowChange = function(change) {
            scope.curPage += change;
          };
        }
      };
    });

  });
