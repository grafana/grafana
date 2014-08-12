define([
  'angular',
  'app',
  'lodash'
],
function (angular, app) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LoginCtrl', function($scope, $http, $location) {
    $scope.loginModel = {};

    $scope.login = function() {
      delete $scope.loginError;
      if (!$scope.loginForm.$valid) {
        return;
      }

      $http.post('/login', $scope.loginModel).then(function(results) {
        $location.path('/');
      }, function(err) {
        if (err.status === 401) {
          $scope.loginError = "Username or password is incorrect";
        }
        else {
          $scope.loginErro = "Unexpected error";
        }
      });
    };

  });

});
