define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AccountCtrl', function($scope, $http, backendSrv) {

    $scope.init = function() {
      $scope.getAccount();
    };

    $scope.getAccount = function() {
      backendSrv.get('/api/account').then(function(account) {
        $scope.account = account;
      });
    };

    $scope.update = function() {
      if (!$scope.accountForm.$valid) { return; }
      backendSrv.put('/api/account', $scope.account).then($scope.getAccount);
    };

    $scope.init();

  });
});
