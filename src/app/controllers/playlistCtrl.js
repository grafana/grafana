define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.controllers');

  module.controller('PlaylistCtrl', function($scope, playlistSrv) {

    $scope.init = function() {
      $scope.timespan = "15s";
      $scope.loadFavorites();
      $scope.$on('modal-opened', $scope.loadFavorites);
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