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

    $scope.deleteUser = function(user) {
      $scope.appEvent('confirm-modal', {
        title: 'Delete user',
        text: 'Are you sure you want to delete user: ' + user.login,
        onConfirm: function() {
          backendSrv.delete('/api/admin/users/' + user.id).then(function() {
            $scope.getUsers();
          });
        }
      });
    };

    $scope.init();

  });
});
