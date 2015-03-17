define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointSummaryCtrl', function($scope, $http, backendSrv, $location, $routeParams) {
    $scope.init = function() {
      $scope.endpoints = [];
      $scope.monitors = {};
      $scope.endpoint = null;
      var promise = $scope.getEndpoints();
      promise.then(function() {
        $scope.getEndpoint($routeParams.id);
      });

    };

    $scope.getEndpoints = function() {
      var promise = backendSrv.get('/api/endpoints')
      promise.then(function(endpoints) {
        $scope.endpoints = endpoints;
      });
      return promise;
    };
    $scope.tagsUpdated = function(newVal) {
      backendSrv.post("/api/endpoints", $scope.endpoint);
    }
    $scope.getEndpoint = function(id) {
      _.forEach($scope.endpoints, function(endpoint) {
        if (endpoint.id == id) {
          $scope.endpoint = endpoint;
          //get monitors for this endpoint.
          backendSrv.get('/api/monitors?endpoint_id='+id).then(function(monitors) {
            _.forEach(monitors, function(monitor) {
              $scope.monitors[monitor.monitor_type_id] = monitor;
            });
          });
        }
      });
    };

    $scope.setEndpoint = function(id) {
      $location.path('/endpoints/summary/'+id);
    }

    $scope.init();
  });
});
