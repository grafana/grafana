define([
  'angular',
  'lodash',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistCtrl', function($scope, playlistSrv, datasourceSrv) {

    $scope.init = function() {
      $scope.playlist = [];
      $scope.timespan = config.playlist_timespan;
      $scope.db = datasourceSrv.getGrafanaDB();
      $scope.search();
    };

    $scope.search = function() {
      var query = {starred: true, limit: 10};

      if ($scope.searchQuery) {
        query.query = $scope.searchQuery;
        query.starred = false;
      }

      $scope.db.searchDashboards(query).then(function(results) {
        $scope.searchHits = results.dashboards;
      });
    };

    $scope.addDashboard = function(dashboard) {
      $scope.playlist.push(dashboard);
    };

    $scope.removeDashboard = function(dashboard) {
      $scope.playlist = _.without($scope.playlist, dashboard);
    };

    $scope.start = function() {
      playlistSrv.start($scope.playlist, $scope.timespan);
    };

  });

});
