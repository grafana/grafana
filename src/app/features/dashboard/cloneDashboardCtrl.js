define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CloneDashboardCtrl', function($scope, backendSrv, $location) {

    $scope.init = function() {
      $scope.clone.id = null;
      $scope.clone.editable = true;
      $scope.clone.title = $scope.clone.title + " Copy";
    };

    $scope.saveClone = function() {
      backendSrv.saveDashboard($scope.clone)
        .then(function(result) {
          $scope.appEvent('alert-success', ['Dashboard saved', 'Saved as ' + result.title]);
          $location.url(result.url);
          $scope.appEvent('dashboard-saved', $scope.clone);
          $scope.dismiss();
        });
    };
  });

});
