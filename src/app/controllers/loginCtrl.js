define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LoginCtrl', function($scope, backendSrv, $location, $routeParams, alertSrv) {

    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    $scope.grafana.sidemenu = false;
    $scope.loginMode = true;
    $scope.submitBtnClass = 'btn-inverse';
    $scope.submitBtnText = 'Log in';
    $scope.strengthClass = '';

    $scope.init = function() {
      if ($routeParams.logout) {
        $scope.logout();
      }

      $scope.$watch("loginMode", $scope.loginModeChanged);
      $scope.passwordChanged();
    };

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

    $scope.loginModeChanged = function(newValue) {
      $scope.submitBtnText = newValue ? 'Log in' : 'Sign up';
    };

    $scope.passwordChanged = function(newValue) {
      if (!newValue) {
        $scope.strengthText = "";
        $scope.strengthClass = "hidden";
        return;
      }
      if (newValue.length < 4) {
        $scope.strengthText = "strength: weak sauce.";
        $scope.strengthClass = "password-strength-bad";
        return;
      }
      if (newValue.length <= 6) {
        $scope.strengthText = "strength: you can do better.";
        $scope.strengthClass = "password-strength-ok";
        return;
      }

      $scope.strengthText = "strength: strong like a bull.";
      $scope.strengthClass = "password-strength-good";
    };

    $scope.signUp = function() {
      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/signup', $scope.formModel).then(function() {
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

      backendSrv.post('/login', $scope.formModel).then(function() {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();

  });

});
