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
    $scope.loginMode = true;

    // build info view model
    $scope.buildInfo = {
      version: config.buildInfo.version,
      commit: config.buildInfo.commit,
      buildstamp: new Date(config.buildInfo.buildstamp * 1000)
    };

    $scope.submit = function() {
      if ($scope.loginMode) {
        $scope.login();
      } else {
        $scope.signUp();
      }
    };

    $scope.getSubmitBtnClass = function() {
      if ($scope.loginForm.$valid) {
        return "btn-primary";
      } else {
        return "btn-inverse";
      }
    };

    $scope.getSubmitBtnText = function() {
      if ($scope.loginMode) {
        return "Log in";
      } else {
        return "Sign up";
      }
    };

    $scope.init = function() {
      if ($routeParams.logout) {
        $scope.logout();
      }
    };

    $scope.signUp = function() {
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
