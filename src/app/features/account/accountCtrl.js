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
        $scope.collaborators = account.collaborators;
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

    $scope.removeCollaborator = function(collaborator) {
      backendSrv.request({
        method: 'DELETE',
        url: '/api/account/collaborators/' + collaborator.id,
        desc: 'Remove collaborator',
      }).then($scope.getAccount);
    };

    $scope.addCollaborator = function() {
      if (!$scope.addCollaboratorForm.$valid) {
        return;
      }

      backendSrv.request({
        method: 'PUT',
        url: '/api/account/collaborators',
        data: $scope.collaborator,
        desc: 'Add collaborator'
      }).then($scope.getAccount);
    };

    $scope.init();

  });
});
