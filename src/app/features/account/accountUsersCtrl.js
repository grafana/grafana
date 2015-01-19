define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AccountUsersCtrl', function($scope, $http, backendSrv) {

    $scope.user = {
      loginOrEmail: '',
      role: 'Viewer',
    };

    $scope.init = function() {
      $scope.get();
    };

    $scope.get = function() {
      backendSrv.get('/api/account/users').then(function(users) {
        $scope.users = users;
      });
    };

    $scope.removeUser = function(user) {
      backendSrv.request({
        method: 'DELETE',
        url: '/api/account/users/' + user.id,
      }).then($scope.get);
    };

    $scope.addUser = function() {
      if (!$scope.form.$valid) {
        return;
      }

      backendSrv.request({
        method: 'PUT',
        url: '/api/account/users',
        data: $scope.user,
      }).then($scope.get);
    };

    $scope.init();

  });
});
