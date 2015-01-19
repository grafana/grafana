define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminUsersCtrl', function($scope, backendSrv) {

    $scope.init = function() {
      $scope.accounts = [];
      $scope.getUsers();
    };

    $scope.getUsers = function() {
      backendSrv.get('/api/admin/users').then(function(users) {
        $scope.users = users;
      });
    };

    $scope.init();

  });
});
