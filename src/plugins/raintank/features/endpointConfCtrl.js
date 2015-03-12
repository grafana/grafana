define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('EndpointConfCtrl', function($scope, $q, $location, $routeParams, $http, backendSrv) {

    var defaults = {
      name: '',
    };

    $scope.init = function() {
      if ("id" in $routeParams) {
        $scope.getEndpoint($routeParams.id);
        $scope.monitors = {};
      } else {
        $scope.reset();
      }
      $scope.checks = {};
      $scope.getLocations();
      $scope.getMonitorTypes();
      $scope.$watch('endpoint.name', function(newVal, oldVal) {
        for (var id in $scope.monitors) {
          var monitor = $scope.monitors[id];
          _.forEach(monitor.settings, function(setting) {
            if ((setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") && ((setting.value == "") || (setting.value == oldVal))) {
              setting.value = newVal;
            }
          });
        }
      });
    };

    $scope.getLocations = function() {
      var locationMap = {};
      $scope.locationGroups = ["all"];
      $scope.locationsByGroup = {"all": []};
      backendSrv.get('/api/locations').then(function(locations) {
        _.forEach(locations, function(loc) {
          locationMap[loc.id] = loc;
          $scope.locationsByGroup.all.push(loc.id);
        });
        $scope.locations = locationMap;
      });
    };

    $scope.getMonitorTypes = function() {
      backendSrv.get('/api/monitor_types').then(function(types) {
        var typesMap = {};
        _.forEach(types, function(type) {
          typesMap[type.id] = type;
          var settings = [];
          _.forEach(type.settings, function(setting) {
            var val = setting.default_value;
            if (setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") {
              val = $scope.endpoint.name || "";
            }
            settings.push({variable: setting.variable, value: val});
          });
          if (!(type.id in $scope.monitors)) {
            $scope.monitors[type.id] = {
              endpoint_id: null,
              monitor_type_id: type.id,
              locationGroup: 'all',
              settings: settings,
              enabled: false,
              frequency: 10,
            };
          }
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
      if (! found) {
        monitor.settings.push(s);
      }
      return s;
    }
    $scope.reset = function() {
      $scope.endpoint = angular.copy(defaults);
      $scope.monitors = {};
    };

    $scope.cancel = function() {
      $scope.reset();
      location.back();
    };

    $scope.getEndpoint = function(id) {
      backendSrv.get('/api/endpoints/'+id).then(function(endpoint) {
        $scope.endpoint = endpoint;
        //get monitors for this endpoint.
        backendSrv.get('/api/monitors?endpoint_id='+id).then(function(monitors) {
          _.forEach(monitors, function(monitor) {
            $scope.monitors[monitor.monitor_type_id] = monitor;
          });
        });
      });
    };
    $scope.remove = function(endpoint) {
      backendSrv.delete('/api/endpoints/' + endpoint.id).then(function() {
        $scope.getEndpoints();
      });
    };

    $scope.removeMonitor = function(mon) {
      var type_id = mon.monitor_type_id;
      backendSrv.delete('/api/monitors/' + mon.id).then(function() {
        var settings = [];
        _.forEach($scope.monitor_types[type_id].settings, function(setting) {
          var val = setting.default_value;
          if (setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") {
            val = $scope.endpoint.name;
          }
          settings.push({variable: setting.variable, value: val});
        });
        $scope.monitors[type_id] = {
          endpoint_id: null,
          monitor_type_id: type_id,
          locationGroup: 'all',
          settings: settings,
          enabled: false,
          frequency: 10,
        };
      });
    };

    $scope.updateEndpoint = function() {
      backendSrv.post('/api/endpoints', $scope.endpoint);
    };
    $scope.getLocationsByGroup = function(group) {
      if (group in $scope.locationsByGroup) {
        return $scope.locationsByGroup[group];
      }
    };
    $scope.save = function() {
      var promises = [];
      _.forEach($scope.monitors, function(monitor) {
        monitor.endpoint_id = $scope.endpoint.id;
        monitor.locations = $scope.getLocationsByGroup(monitor.locationGroup);
        delete monitor.locationGroup;
        if (monitor.id) {
          promises.push(backendSrv.post('/api/monitors', monitor));
        } else if (monitor.enabled) {
          promises.push(backendSrv.put('/api/monitors', monitor));
        }
      });

      $q.all(promises).then(function() {
        $location.path("/endpoints");
      });
    }

    $scope.updateMonitor = function(monitor) {
      backendSrv.post('/api/monitors', monitor);
    }

    $scope.parseSuggestions = function(payload) {
      var locations = [];
      _.forEach(Object.keys($scope.locations), function(loc) {
        locations.push(parseInt(loc));
      });
      var defaults = {
        endpoint_id: payload.endpoint.id,
        monitor_type_id: 1,
        locationGroup: 'all',
        settings: [],
        enabled: true,
        frequency: 10,
      };
      _.forEach(payload.suggested_monitors, function(suggestion) {
        _.defaults(suggestion, defaults);
        $scope.monitors[suggestion.monitor_type_id] = suggestion;
      });
      $scope.endpoint.id = payload.endpoint.id;
    }

    $scope.add = function() {
      if (!$scope.endpointForm.$valid) {
        console.log("form invalid");
        return;
      }

      backendSrv.put('/api/endpoints', $scope.endpoint)
        .then(function(resp) {
          $scope.parseSuggestions(resp);
        });
    };

    $scope.init();

  });
});
