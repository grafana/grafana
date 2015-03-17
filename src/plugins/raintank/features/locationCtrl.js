define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LocationCtrl', function($scope, $http, backendSrv, contextSrv) {
    $scope.init = function() {
      $scope.location_filter = "";
      $scope.status_filter = "All Statuses";
      $scope.sort_field = "Location";
      $scope.locations = [];
      $scope.getLocations();
    };
    $scope.locationTags = function() {
      var map = {};
      _.forEach($scope.locations, function(location) {
        _.forEach(location.tags, function(tag) {
          map[tag] = true;
        });
      });
      return Object.keys(map);
    }
    $scope.setLocationFilter = function(tag) {
      $scope.location_filter = tag;
    };

    $scope.edit = function(loc) {
      $scope.current = loc;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
    };

    $scope.getLocations = function() {
      backendSrv.get('/api/locations').then(function(locations) {
        $scope.locations = locations;
      });
    };
    
    $scope.remove = function(loc) {
      backendSrv.delete('/api/locations/' + loc.id).then(function() {
        $scope.getLocations();
      });
    };

    $scope.init();
  });
});
