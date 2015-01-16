define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AccountCtrl', function($scope, $http, backendSrv) {

    $scope.collaborator = {};
    $scope.token = {
      role: "ReadWrite"
    };
    $scope.roleTypes = [
      "ReadWrite",
      "Read"
    ];
    $scope.showTokens = false;

    $scope.init = function() {
      $scope.getAccount();
      $scope.getOtherAccounts();
      $scope.getTokens();
      
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

    $scope.getTokens = function() {
      backendSrv.get('/api/tokens').then(function(tokens) {
        $scope.tokens = tokens;
      });
    }

    $scope.removeToken = function(id) {
      backendSrv.delete('/api/tokens/'+id).then($scope.getTokens);
    }

    $scope.addToken = function() {
      backendSrv.request({
        method: 'PUT',
        url: '/api/tokens',
        data: $scope.token,
        desc: 'Add token'
      }).then($scope.getTokens);
    }

    $scope.update = function() {
      if (!$scope.accountForm.$valid) { return; }

      backendSrv.post('/api/account/', $scope.account);
    };

    $scope.init();

  });
});
