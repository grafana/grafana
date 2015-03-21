define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ShareSnapshotCtrl', function($scope, $rootScope, backendSrv, $timeout) {

    $scope.snapshot = function() {
      $scope.dashboard.snapshot = true;
      $rootScope.$broadcast('refresh');

      $timeout(function() {
        var dash = angular.copy($scope.dashboard);
        backendSrv.post('/api/snapshots/', {
          dashboard: dash
        }).then(function(results) {
          console.log(results);
        });

        $scope.dashboard.snapshot = false;
        $scope.appEvent('dashboard-snapshot-cleanup');
      }, 2000);
    };

  });

});
