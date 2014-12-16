define([
  'angular',
  'services/pro/backendSrv',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DataSourcesCtrl', function($scope, $http, backendSrv) {

    $scope.init = function() {
    };

    $scope.getAccount = function() {
      backendSrv.get('/api/account/').then(function(account) {
        $scope.account = account;
        $scope.collaborators = account.collaborators;
      });
    };

    $scope.init();

  });
});
