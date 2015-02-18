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
        $scope.createMode = false;
        $scope.getUser($routeParams.id);
      } else {
        $scope.createMode = true;
      }
    };

    $scope.getUser = function(id) {
      backendSrv.get('/api/admin/users/' + id).then(function(user) {
        $scope.user = user;
        $scope.user_id = id;
      });
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }
      if ($scope.createMode) {
        backendSrv.post('/api/admin/users', $scope.user).then(function() {
          $location.path('/admin/users');
        });
      } else {
        backendSrv.put('/api/admin/users/' + $scope.user_id, $scope.user).then(function() {
          $location.path('/admin/users');
        });
      }
    };

    $scope.init();

  });
});
