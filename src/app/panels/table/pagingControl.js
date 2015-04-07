define([
  'angular'
],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('grafanaTablePager', function() {
      return {
        restrict: 'A',
        templateUrl: 'app/panels/table/pagingControl.html',
        link: function(scope) {
          scope.arrowChange = function(change) {
            // older browsers may not support number input type, so make sure we parse input as text
            var numericPage = parseInt(scope.panel.curTablePage) || 1;
            scope.panel.curTablePage = numericPage + change;
          };
        }
      };
    });
  });
