define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('InfluxTargetCtrl', function($scope) {

    $scope.init = function() {
      if (!$scope.target.function) {
        $scope.target.function = 'mean';
      }
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

  });

});