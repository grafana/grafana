define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AccountCtrl', function($scope, $http, backendSrv) {

    $scope.collaborator = {};

    $scope.init = function() {
      $scope.getAccount();
      $scope.getOtherAccounts();
    };

    $scope.getAccount = function() {
      backendSrv.get('/api/account/').then(function(account) {
        $scope.account = account;
      });
    };

    $scope.getOtherAccounts = function() {
      backendSrv.get('/api/account/others').then(function(otherAccounts) {
        $scope.otherAccounts = otherAccounts;
      });
    };

    $scope.setUsingAccount = function(otherAccount) {
      backendSrv.request({
        method: 'POST',
        url: '/api/account/using/' + otherAccount.accountId,
        desc: 'Change active account',
      }).then($scope.getOtherAccounts);
    };

    $scope.update = function() {
      if (!$scope.accountForm.$valid) { return; }

      backendSrv.post('/api/account/', $scope.account);
    };

    $scope.init();

  });
});
