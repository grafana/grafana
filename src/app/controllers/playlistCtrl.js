define([
  'angular'
],
function (angular) {
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
    };

    $scope.start = function() {
      playlistSrv.start($scope.favDashboards, $scope.timespan);
    };

  });

});