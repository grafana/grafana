define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LocationSummaryCtrl', function($scope, $http, backendSrv, $location, $routeParams) {
    $scope.init = function() {
      $scope.locations = [];
      $scope.monitors = {};
      $scope.location = null;
      var promise = $scope.getLocations();
      promise.then(function() {
        $scope.getLocation($routeParams.id);
      });

    };

    $scope.getLocations = function() {
      var promise = backendSrv.get('/api/locations')
      promise.then(function(locations) {
        $scope.locations = locations;
      });
      return promise;
    };
    $scope.tagsUpdated = function(newVal) {
      backendSrv.post("/api/locations", $scope.location);
    }
    $scope.getLocation = function(id) {
      _.forEach($scope.locations, function(location) {
        if (location.id == id) {
          $scope.location = location;
          //get monitors for this location.
          backendSrv.get('/api/monitors?location_id='+id).then(function(monitors) {
            _.forEach(monitors, function(monitor) {
              $scope.monitors[monitor.monitor_type_id] = monitor;
            });
          });
        }
      });
    };

    $scope.setLocation = function(id) {
      $location.path('/locations/summary/'+id);
    }

    $scope.init();
  });
});
