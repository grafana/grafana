define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminEditUserCtrl', function($scope, $routeParams, backendSrv, $location) {
    $scope.user = {};

    $scope.init = function() {
      if ($routeParams.id) {
        $scope.getUser($routeParams.id);
      }
    };

    $scope.getUser = function(id) {
      backendSrv.get('/api/admin/users/' + id).then(function(user) {
        $scope.user = user;
        $scope.user_id = id;
      });
    };

    $scope.setPassword = function () {
      if (!$scope.passwordForm.$valid) { return; }

      var payload = { password: $scope.password };
      backendSrv.put('/api/admin/users/' + $scope.user_id + '/password', payload).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.create = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.post('/api/admin/users', $scope.user).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.put('/api/admin/users/' + $scope.user_id + '/details', $scope.user).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.init();

  });
});
