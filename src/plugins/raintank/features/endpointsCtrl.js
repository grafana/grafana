define([
  'angular',
  'wu.masonry'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointsCtrl', function($scope, $http, backendSrv) {

    var defaults = {
      name: '',
    };

    $scope.init = function() {
      $scope.endpoint_filter = '';
      $scope.status_filter = "All Statuses";
      $scope.sort_field = 'name';
      $scope.endpoints = [];
      $scope.getEndpoints();
      $scope.getCollectors();
      $scope.getMonitorTypes();
    };

    $scope.endpointTags = function() {
      var map = {};
      _.forEach($scope.endpoints, function(endpoint) {
        _.forEach(endpoint.tags, function(tag) {
          map[tag] = true;
        });
      });
      return Object.keys(map);
    }

    $scope.setEndpointFilter = function(tag) {
      $scope.endpoint_filter = tag;
    };

    $scope.getCollectors = function() {
      var collectorMap = {};
      backendSrv.get('/api/collectors').then(function(collectors) {
        _.forEach(collectors, function(loc) {
          collectorMap[loc.id] = loc;
        });
        $scope.collectors = collectorMap;
      });
    };

    $scope.getMonitorTypes = function() {
      backendSrv.get('/api/monitor_types').then(function(types) {
        var typesMap = {};
        _.forEach(types, function(type) {
          typesMap[type.id] = type;
        });
        $scope.monitor_types = typesMap;
      });
    };

    $scope.getEndpoints = function() {
      backendSrv.get('/api/endpoints').then(function(endpoints) {
        $scope.endpoints = endpoints;
      });
    };
    $scope.remove = function(endpoint) {
      backendSrv.delete('/api/endpoints/' + endpoint.id).then(function() {
        $scope.getEndpoints();
      });
    };

    $scope.init();

  });
});
