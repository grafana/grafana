define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LoginCtrl', function($scope, backendSrv, $location, $routeParams, alertSrv) {
    $scope.loginModel = {};
    $scope.grafana.sidemenu = false;

    // build info view model
    $scope.buildInfo = {
      version: config.buildInfo.version,
      commit: config.buildInfo.commit,
      buildstamp: new Date(config.buildInfo.buildstamp * 1000)
    };

    $scope.init = function() {
      if ($routeParams.logout) {
        $scope.logout();
      }
    };

    $scope.logout = function() {
      backendSrv.post('/logout').then(function() {
        alertSrv.set('Logged out!', '', 'success', 3000);
        $scope.appEvent('logged-out');
        $location.search({});
      });
    };

    $scope.login = function() {
      delete $scope.loginError;

      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/login', $scope.loginModel).then(function(results) {
        $scope.appEvent('logged-in', results.user);
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();

  });

});
