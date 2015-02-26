define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OrgApiKeysCtrl', function($scope, $http, backendSrv) {

    $scope.roleTypes = ['Viewer', 'Editor', 'Admin'];
    $scope.token = { role: 'Viewer' };

    $scope.init = function() {
      $scope.getTokens();
    };

    $scope.getTokens = function() {
      backendSrv.get('/api/auth/keys').then(function(tokens) {
        $scope.tokens = tokens;
      });
    };

    $scope.removeToken = function(id) {
      backendSrv.delete('/api/auth/keys/'+id).then($scope.getTokens);
    };

    $scope.addToken = function() {
      backendSrv.post('/api/auth/keys', $scope.token).then($scope.getTokens);
    };

    $scope.init();

  });
});
