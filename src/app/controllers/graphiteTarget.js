define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('GraphiteTargetCtrl', function($scope) {

      $scope.init = function() {
        console.log('target:', $scope.target);
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