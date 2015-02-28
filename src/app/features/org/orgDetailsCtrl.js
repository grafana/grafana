define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OrgDetailsCtrl', function($scope, $http, backendSrv, contextSrv) {

    $scope.init = function() {
      $scope.getOrgInfo();
    };

    $scope.getOrgInfo = function() {
      backendSrv.get('/api/org').then(function(org) {
        $scope.org = org;
        contextSrv.user.orgName = org.name;
      });
    };

    $scope.update = function() {
      if (!$scope.orgForm.$valid) { return; }
      backendSrv.put('/api/org', $scope.org).then($scope.getOrgInfo);
    };

    $scope.init();

  });
});
