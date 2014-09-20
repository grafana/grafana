define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AccountCtrl', function($scope, $http, alertSrv) {

    $scope.collaborator = {};

    $scope.init = function() {
      $scope.getAccountInfo();
    };

    $scope.getAccountInfo = function() {

    };

    $scope.addCollaborator = function() {
      if (!$scope.addCollaboratorForm.$valid) {
        return;
      }

      $http.post('/api/account/collaborators/add', $scope.collaborator).then(function() {
        alertSrv.set('Collaborator added', '', 'success', 3000);
      }, function(err) {
        if (err.data && err.data.status) {
          alertSrv.set('Could not add collaborator', err.data.status, 'warning', 10000);
        }
        else if (err.statusText) {
          alertSrv.set('Could not add collaborator', err.data.status, 'warning', 10000);
        }
      });
    };

  });
});
