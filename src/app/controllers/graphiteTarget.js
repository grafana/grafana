define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('GraphiteTargetCtrl', function($scope, $http) {

    $scope.init = function() {
      $scope.segments = [];
      var strSegments = $scope.target.target.split('.');
      _.each(strSegments, function (segment, index) {
        if (segment === '*') {
          $scope.segments[index] = { val: segment, html: '<i class="icon-asterisk"><i>' };
          return;
        }

        $scope.segments[index] = { val: segment, html: segment};
      });
    };

    function getSegmentPathUpTo(index) {
      var arr = $scope.segments.slice(0, index);

      return _.reduce(arr, function(result, segment) {
        return result ? (result + "." + segment.val) : segment.val;
      }, null);
    }

    $scope.getItems = function (index) {
      $scope.altSegments = [];
      var metricPath = getSegmentPathUpTo(index) + '.*';
      var url = config.graphiteUrl + '/metrics/find/?query=' + metricPath;
      return $http.get(url)
        .then(function(result) {
          $scope.altSegments = result.data;
        });
    };

    $scope.setSegment = function (altIndex, segmentIndex) {
      $scope.segments[segmentIndex].val = $scope.altSegments[altIndex].text;
      $scope.segments[segmentIndex].html = $scope.altSegments[altIndex].text;
      $scope.target.target = getSegmentPathUpTo($scope.segments.length);
      $scope.targetChanged();
    };

    $scope.targetChanged = function() {
      $scope.$parent.get_data();
      $scope.editMode = false;
    };

    $scope.edit = function() {
      $scope.editMode = true;
    };

  });
});