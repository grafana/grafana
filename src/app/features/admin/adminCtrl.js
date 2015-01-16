define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminCtrl', function($scope) {

    $scope.init = function() {
      $scope.editor = {index: 0};
    };

    $scope.init();

  });
});
