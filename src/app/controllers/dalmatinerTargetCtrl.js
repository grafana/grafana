define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  var bucketList = null;
 var metricList = {};

  module.controller('DalmatinerTargetCtrl', function($scope, $timeout) {

    $scope.init = function() {
      $scope.target.function = $scope.target.function || 'avg';

      $scope.rawQuery = false;

      $scope.functions = [
        'avg', 'sum', 'min', 'max', 'distinct'
      ];

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
        console.log("change", $scope.target);
      $scope.target.function = func;
      $scope.get_data();
    };

    $scope.listBuckets = function(query, callback) {
      if (!bucketList) {
        bucketList = [];
        $scope.datasource.listBuckets().then(function(series) {
          bucketList = series;
          callback(bucketList);
        });
      }
      else {
        return bucketList;
      }
    };

      $scope.listMetrics = function(query, callback) {
          var b = $scope.target.bucket;
      if (!metricList[b]) {
        metricList[b] = [];
        $scope.datasource.listMetrics($scope.target.bucket).then(function(series) {
          metricList[b] = series;
          callback(metricList[b]);
        });
      }
      else {
        return metricList[b];
      }
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

  });

});
