define([
  'angular',
  'lodash',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistCtrl', function($scope, playlistSrv) {

    $scope.init = function() {
      $scope.timespan = config.playlist_timespan;
      $scope.loadFavorites();
    };

    $scope.loadFavorites = function() {
      $scope.favDashboards = playlistSrv.getFavorites().dashboards;

      _.each($scope.favDashboards, function(dashboard) {
        dashboard.include = true;
      });
    };

    $scope.removeAsFavorite = function(dashboard) {
      playlistSrv.removeAsFavorite(dashboard);
      $scope.loadFavorites();
    };

    $scope.start = function() {
      var included = _.where($scope.favDashboards, { include: true });
      playlistSrv.start(included, $scope.timespan);
    };

  });

});
