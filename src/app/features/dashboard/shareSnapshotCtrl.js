define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ShareSnapshotCtrl', function($scope, $rootScope, $location, backendSrv, $timeout) {

    $scope.snapshot = {
      name: $scope.dashboard.title
    };

    $scope.createSnapshot = function() {
      $scope.dashboard.snapshot = true;
      $scope.loading = true;
      $rootScope.$broadcast('refresh');

      $timeout(function() {
        var dash = angular.copy($scope.dashboard);
        backendSrv.post('/api/snapshots/', {dashboard: dash}).then(function(results) {
          $scope.loading = false;

          var baseUrl = $location.absUrl().replace($location.url(), "");
          $scope.snapshotUrl = baseUrl + '/dashboard/snapshots/' + results.key;

        }, function() {
          $scope.loading = false;
        });

        $scope.dashboard.snapshot = false;
        $scope.appEvent('dashboard-snapshot-cleanup');
      }, 2000);
    };

  });

});
