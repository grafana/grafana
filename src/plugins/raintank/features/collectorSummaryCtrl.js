define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CollectorSummaryCtrl', function($scope, $http, backendSrv, $location, $routeParams) {
    $scope.init = function() {
      $scope.collectors = [];
      $scope.monitors = {};
      $scope.collector = null;
      var promise = $scope.getCollectors();
      promise.then(function() {
        $scope.getCollector($routeParams.id);
      });

    };

    $scope.getCollectors = function() {
      var promise = backendSrv.get('/api/locations')
      promise.then(function(collectors) {
        $scope.collectors = collectors;
      });
      return promise;
    };
    $scope.tagsUpdated = function(newVal) {
      backendSrv.post("/api/locations", $scope.collector);
    }
    $scope.getCollector = function(id) {
      _.forEach($scope.collectors, function(collector) {
        if (collector.id == id) {
          $scope.collector = collector;
          //get monitors for this collector.
          backendSrv.get('/api/monitors?location_id='+id).then(function(monitors) {
            _.forEach(monitors, function(monitor) {
              $scope.monitors[monitor.monitor_type_id] = monitor;
            });
          });
        }
      });
    };

    $scope.setCollector = function(id) {
      $location.path('/locations/summary/'+id);
    }

    $scope.init();
  });
});
