define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  var seriesList = null;

  module.controller('InfluxTargetCtrl', function($scope, $timeout) {

    $scope.init = function() {
      $scope.target.function = $scope.target.function || 'mean';
      $scope.target.column = $scope.target.column || 'value';

      $scope.rawQuery = false;

      $scope.functions = [
        'count', 'mean', 'sum', 'min',
        'max', 'mode', 'distinct', 'median',
        'derivative', 'stddev', 'first', 'last',
        'difference'
      ];

      $scope.operators = ['=', '=~', '>', '<', '!~', '<>'];
      $scope.oldSeries = $scope.target.series;
      $scope.$on('typeahead-updated', function() {
        $timeout($scope.get_data);
      });
    };

    $scope.showQuery = function () {
      $scope.target.rawQuery = true;
    };

    $scope.hideQuery = function () {
      $scope.target.rawQuery = false;
    };

    // Cannot use typeahead and ng-change on blur at the same time
    $scope.seriesBlur = function() {
      if ($scope.oldSeries !== $scope.target.series) {
        $scope.oldSeries = $scope.target.series;
        $scope.columnList = null;
        $scope.get_data();
      }
    };

    $scope.changeFunction = function(func) {
      $scope.target.function = func;
      $scope.get_data();
    };

    // called outside of digest
    $scope.listColumns = function(query, callback) {
      if (!$scope.columnList) {
        $scope.$apply(function() {
          $scope.datasource.listColumns($scope.target.series).then(function(columns) {
            $scope.columnList = columns;
            callback(columns);
          });
        });
      }
      else {
        return $scope.columnList;
      }
    };

    $scope.listSeries = function(query, callback) {
      if (!seriesList || query === '') {
        seriesList = [];
        $scope.datasource.listSeries().then(function(series) {
          seriesList = series;
          callback(seriesList);
        });
      }
      else {
        return seriesList;
      }
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

  });

});
