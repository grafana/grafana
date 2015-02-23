define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OrgDetailsCtrl', function($scope, $http, backendSrv) {

    $scope.init = function() {
      $scope.getOrgInfo();
    };

    $scope.getOrgInfo = function() {
      backendSrv.get('/api/org').then(function(account) {
        $scope.org = account;
      });
    };

    $scope.update = function() {
      if (!$scope.orgForm.$valid) { return; }
      backendSrv.put('/api/org', $scope.org).then($scope.getOrgInfo);
    };

    $scope.init();

  });
});
