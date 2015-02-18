define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ProfileCtrl', function($scope, $http, backendSrv) {

    $scope.newAccount = {name: ''};

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
      backendSrv.post('/api/user/using/' + account.accountId).then(function() {
        window.location.href = config.appSubUrl + '/profile';
      });
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }
      backendSrv.put('/api/user/', $scope.user);
    };

    $scope.createAccount = function() {
      backendSrv.post('/api/account/', $scope.newAccount).then($scope.getUserAccounts);
    };

    $scope.init();

  });
});
