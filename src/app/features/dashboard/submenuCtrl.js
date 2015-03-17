define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SubmenuCtrl', function($scope, $q, $rootScope, templateValuesSrv, dynamicDashboardSrv) {
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

    $scope.setVariableValue = function(param, option) {
      templateValuesSrv.setVariableValue(param, option).then(function() {
        dynamicDashboardSrv.update($scope.dashboard);
        $rootScope.$broadcast('refresh');
      });
    };

    $scope.init();

  });

});
