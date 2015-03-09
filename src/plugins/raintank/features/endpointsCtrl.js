define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointsCtrl', function($scope, $http, backendSrv) {

    var defaults = {
      name: '',
    };

    $scope.init = function() {
      $scope.reset();
      $scope.editor = {index: 0};
      $scope.endpoint_filter = '';
      $scope.location_filter = '';
      $scope.endpoints = [];
      $scope.getEndpoints();
      $scope.getLocations();
      $scope.getMonitorTypes();
      $scope.$watch('editor.index', function(newVal) {
        if (newVal < 2) {
          $scope.reset();
        }
      });
      
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
    
    $scope.getLocations = function() {
      var locationMap = {};
      backendSrv.get('/api/locations').then(function(locations) {
        _.forEach(locations, function(loc) {
          locationMap[loc.id] = loc;
        });
        $scope.locations = locationMap;
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
    $scope.currentSettingByVariable = function(monitor, variable) {
      var s = {
        "variable": variable,
        "value": null
      };
      var found = false
      _.forEach(monitor.settings, function(setting) {
        if (found) {
          return;
        }
        if (setting.variable == variable) {
          s = setting;
          found = true;
        }
      });
      if (! found ) {
        monitor.settings.push(s);
      }
      return s;
    }
    $scope.reset = function() {
      $scope.current = angular.copy(defaults);
      $scope.currentIsNew = true;
      $scope.suggested_monitors = null;
    };

    $scope.edit = function(endpoint) {
      $scope.current = endpoint;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
    };

    $scope.cancel = function() {
      $scope.reset();
      $scope.editor.index = 0;
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

    $scope.update = function() {
      backendSrv.post('/api/endpoints', $scope.current).then(function() {
        $scope.editor.index = 0;
        $scope.getLocations();
      });
    };
    $scope.parseSuggestions = function(payload) {
      var locations = [];
      _.forEach(Object.keys($scope.locations), function(loc) {
        locations.push(parseInt(loc));
      })
      var defaults = {
        endpoint_id: payload.endpoint.id,
        monitor_type_id: 1,
        locations: locations,
        settings: [],
        enabled: true,
        frequency: 10,
      };
      _.forEach(payload.suggested_monitors, function(suggestion) {
        _.defaults(suggestion, defaults);
      });
      console.log(payload);
      return payload.suggested_monitors;
    }

    $scope.removeSuggestion = function(index) {
      $scope.suggested_monitors.splice(index, 1);
    }
    $scope.provision = function() {
       if (!$scope.editForm.$valid) {
        return;
      }
      _.forEach($scope.suggested_monitors, function(suggestion) {
        backendSrv.put('/api/monitors', suggestion)
          .then(function() {
            $scope.editor.index = 0;
          });
        });
    }
    $scope.add = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.put('/api/endpoints', $scope.current)
        .then(function(resp) {
          $scope.getEndpoints();
          $scope.editor.index = 3;
          $scope.suggested_monitors = $scope.parseSuggestions(resp);
        });
    };
    $scope.init();

  });
});
