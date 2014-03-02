define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  var seriesList = null;

  module.controller('InfluxTargetCtrl', function($scope, $timeout) {

    $scope.init = function() {
      if (!$scope.target.function) {
        $scope.target.function = 'mean';
      }

      if (!seriesList) {
        seriesList = [];
        $scope.datasource.listSeries().then(function(series) {
          seriesList = series;
        });
      }

      $scope.oldSeris = $scope.target.series;
      $scope.$on('typeahead-updated', function(){
        $timeout($scope.get_data);
      });
    };

    // Cannot use typeahead and ng-change on blur at the same time
    $scope.seriesBlur = function() {
      if ($scope.oldSeris !== $scope.target.series) {
        $scope.oldSeris = $scope.target.series;
        $scope.get_data();
      }
    };

    $scope.listSeries = function() {
      return seriesList;
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

  });

});