define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('SearchCtrl', function($scope, dashboard) {

    $scope.init = function() {
      $scope.elasticsearch = $scope.elasticsearch || {};
      $scope.giveSearchFocus = 0;
    };

    $scope.elasticsearch_dblist = function(query) {
      dashboard.elasticsearch_list(query,100).then(
        function(result) {
        if(!_.isUndefined(result.hits)) {
          $scope.hits = result.hits.total;
          $scope.elasticsearch.dashboards = result.hits.hits;
        }
      });
    };

    $scope.openSearch = function () {
      $scope.giveSearchFocus = $scope.giveSearchFocus + 1;
    };

  });

  module.directive('xngFocus', function() {
    return function(scope, element, attrs) {
       scope.$watch(attrs.xngFocus,
         function (newValue) {
            setTimeout(function() {
              newValue && element.focus();
            }, 200);
         },true);
      };
  });

});