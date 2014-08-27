define([
  'angular',
  'app',
  'lodash'
],
function (angular, app, _) {
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
      $scope.templateParameters = $scope.dashboard.templating.list;
    };

    $scope.disableAnnotation = function (annotation) {
      annotation.enable = !annotation.enable;
      $rootScope.$broadcast('refresh');
    };

    $scope.filterOptionSelected = function(param, option) {
      templateValuesSrv.filterOptionSelected(param, option);
    };

    $scope.init();

  });

});
