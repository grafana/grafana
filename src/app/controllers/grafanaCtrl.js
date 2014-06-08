define([
  'angular',
  'config',
  'underscore',
],
function (angular, config, _) {
  "use strict";

  var module = angular.module('kibana.controllers');

  module.controller('GrafanaCtrl', function($scope, alertSrv, grafanaVersion, $rootScope) {

    $scope.grafanaVersion = grafanaVersion[0] === '@' ? 'master' : grafanaVersion;

    $scope.init = function() {
      $scope._ = _;
      $scope.dashAlerts = alertSrv;

      // Clear existing alerts
      alertSrv.clearAll();
    };

    $scope.onAppEvent = function(name, callback, scope) {
      var unbind = $rootScope.$on(name, callback);
      scope.$on('$destroy', unbind);
    };

    $scope.emitAppEvent = function(name, payload) {
      $rootScope.$emit(name, payload);
    };

    $scope.init();

  });
});
