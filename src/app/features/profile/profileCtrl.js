define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ProfileCtrl', function($scope, $http, backendSrv) {

    $scope.init = function() {
      $scope.getUser();
      $scope.getUserAccounts();
    };

    $scope.getUser = function() {
      backendSrv.get('/api/user').then(function(user) {
        $scope.user = user;
      });
    };

    $scope.getUserAccounts = function() {
      backendSrv.get('/api/user/accounts').then(function(accounts) {
        $scope.accounts = accounts;
      });
    };

    $scope.setUsingAccount = function(account) {
      backendSrv.request({
        method: 'POST',
        url: '/api/user/using/' + account.accountId,
        desc: 'Change active account',
      }).then($scope.getUserAccounts);
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.post('/api/user/', $scope.user);
    };

    $scope.init();

  });
});
