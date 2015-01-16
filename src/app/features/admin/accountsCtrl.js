define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AccountsCtrl', function($scope, backendSrv) {

    $scope.init = function() {
      $scope.accounts = [];
      $scope.getAccounts();
    };

    $scope.getAccounts = function() {
      backendSrv.get('/api/admin/accounts').then(function(accounts) {
        console.log(accounts);
        $scope.accounts = accounts;
      });
    };

    $scope.init();

  });
});
