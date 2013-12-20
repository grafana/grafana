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
            segment = '<i class="icon-asterisk"><i>';
          }

          $scope.segments[index] = { val: segment };
        });
      };

      $scope.setSegmentStar = function (index) {
        $scope.segments[index] = {val: '<i class="icon-asterisk"><i>' };
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