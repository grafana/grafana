define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('SubmenuCtrl', function($scope) {
    var _d = {
      enable: true
    };

    _.defaults($scope.pulldown,_d);

    $scope.init = function() {
      $scope.panel = $scope.pulldown;
      $scope.row = $scope.pulldown;
    };

    $scope.init();

  });

});