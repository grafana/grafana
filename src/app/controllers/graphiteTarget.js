define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('GraphiteTargetCtrl', function($scope) {

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

      $scope.setSegmentStar = function (index) {
        $scope.segments[index].val = '*';
        $scope.segments[index].html = '<i class="icon-asterisk"><i>';
        $scope.target.target = _.reduce($scope.segments, function(result, segment) {
            return result ? (result + "." + segment.val) : segment.val;
          }, null);
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