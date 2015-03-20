define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SubmenuCtrl', function($scope, $q, $rootScope, templateValuesSrv) {
    var _d = {
      enable: true
    };

    _.defaults($scope.pulldown,_d);

    $scope.init = function() {
      $scope.panel = $scope.pulldown;
      $scope.row = $scope.pulldown;
      $scope.variables = $scope.dashboard.templating.list;
      $scope.annotations = $scope.dashboard.templating.list;
    };

    $scope.disableAnnotation = function (annotation) {
      annotation.enable = !annotation.enable;
      $rootScope.$broadcast('refresh');
    };

    $scope.variableUpdated = function(variable) {
      templateValuesSrv.variableUpdated(variable).then(function() {
        $rootScope.$broadcast('refresh');
      });
    };

    $scope.init();

  });

});
