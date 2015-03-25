define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ShareSnapshotCtrl', function($scope, $rootScope, $location, backendSrv, $timeout, timeSrv) {

    $scope.snapshot = {
      name: $scope.dashboard.title,
      expire: 0,
      external: false,
    };

    $scope.step = 1;

    $scope.expireOptions = [
      {text: '1 Hour', value: 60*60},
      {text: '1 Day',  value: 60*60*24},
      {text: '7 Days', value: 60*60*7},
      {text: 'Never',  value: 0},
    ];

    $scope.createSnapshot = function(external) {
      $scope.dashboard.snapshot = {
        timestamp: new Date()
      };

      $scope.loading = true;
      $scope.snapshot.external = external;

      $rootScope.$broadcast('refresh');

      $timeout(function() {
        $scope.saveSnapshot();
      }, 3000);
    };

    $scope.saveSnapshot = function() {
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
      // remove annotations
      dash.annotations.list = [];
      // remove template queries
      _.each(dash.templating.list, function(variable) {
        variable.query = "";
        variable.refresh = false;
      });

      // cleanup snapshotData
      delete $scope.dashboard.snapshot;
      $scope.dashboard.forEachPanel(function(panel) {
        delete panel.snapshotData;
      });

      var cmdData = {
        dashboard: dash,
        external: $scope.snapshot.external,
        expires: $scope.snapshot.expires,
      };

      backendSrv.post('/api/snapshots', cmdData).then(function(results) {
        $scope.loading = false;

        if ($scope.snapshot.external) {
          $scope.snapshotUrl = results.url;
        } else {
          var baseUrl = $location.absUrl().replace($location.url(), "");
          $scope.snapshotUrl = baseUrl + '/dashboard/snapshot/' + results.key;
        }

        $scope.step = 2;
      }, function() {
        $scope.loading = false;
      });
    };

  });

});
