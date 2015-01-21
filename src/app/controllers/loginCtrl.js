define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LoginCtrl', function($scope, backendSrv, $location, $routeParams, alertSrv) {
    $scope.loginModel = {
      user: '',
      password: ''
    };

    $scope.newUser = {};

    $scope.grafana.sidemenu = false;
    $scope.mode = 'login';

    // build info view model
    $scope.buildInfo = {
      version: config.buildInfo.version,
      commit: config.buildInfo.commit,
      buildstamp: new Date(config.buildInfo.buildstamp * 1000)
    };

    $scope.submit = function() {
      if ($scope.mode === 'login') {
        $scope.login();
      } else {
        $scope.signUp();
      }
    };

    $scope.init = function() {
      if ($routeParams.logout) {
        $scope.logout();
      }
    };

    $scope.signUp = function() {
      if ($scope.mode === 'login') {
        $scope.mode = 'signup';
        return;
      }

      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.put('/api/user/signup', $scope.newUser).then(function() {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.logout = function() {
      backendSrv.post('/logout').then(function() {
        alertSrv.set('Logged out!', '', 'success', 3000);
        $scope.appEvent('logged-out');
        $location.search({});
      });
    };

    $scope.login = function() {
      if ($scope.mode === 'signup') {
        $scope.mode = 'login';
        return;
      }
      delete $scope.loginError;

      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/login', $scope.loginModel).then(function() {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();

  });

});
