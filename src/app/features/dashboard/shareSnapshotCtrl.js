define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ShareSnapshotCtrl', function($scope, $rootScope, $location, backendSrv, $timeout, timeSrv) {

    $scope.snapshot = {
      name: $scope.dashboard.title
    };

    $scope.createSnapshot = function(makePublic) {
      $scope.dashboard.snapshot = true;
      $scope.loading = true;
      $rootScope.$broadcast('refresh');

      $timeout(function() {
        $scope.saveSnapshot(makePublic);
      }, 2000);
    };

    $scope.saveSnapshot = function(external) {
      var dash = angular.copy($scope.dashboard);
      // change title
      dash.title = $scope.snapshot.name;
      // make relative times absolute
      dash.time = timeSrv.timeRange();
      // remove panel queries & links
      dash.forEachPanel(function(panel) {
        panel.targets = [];
        panel.links = [];
      });

      // cleanup snapshotData
      $scope.dashboard.snapshot = false;
      $scope.dashboard.forEachPanel(function(panel) {
        delete panel.snapshotData;
      });

      backendSrv.post('/api/snapshots', {dashboard: dash, external: external}).then(function(results) {
        $scope.loading = false;

        if (external) {
          $scope.snapshotUrl = results.url;
        } else {
          var baseUrl = $location.absUrl().replace($location.url(), "");
          $scope.snapshotUrl = baseUrl + '/dashboard/snapshots/' + results.key;
        }
      }, function() {
        $scope.loading = false;
      });
    };

  });

});
