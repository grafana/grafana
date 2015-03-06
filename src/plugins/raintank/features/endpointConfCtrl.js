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
      } else {
        $scope.reset();
      }
      $scope.checks = {};
      $scope.getLocations();
      $scope.getMonitorTypes();
      $scope.$watch('endpoint.name', function(newVal, oldVal) {
        for (var id in $scope.checks) {
          var check = $scope.checks[id];
          console.log(check);
          _.forEach(check.settings, function(setting) {
            if ((setting.variable == "host" || setting.variable == "name" || setting.variable == "hostname") && (setting.value == oldVal)) {
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
        _.forEach(types, function(type) {
          $scope.checks[type.id] = {
            endpoint_id: null,
            monitor_type_id: type.id,
            locationGroup: 'all',
            settings: [],
            enabled: true,
            frequency: 10,
          };
        });
        $scope.monitor_types = types;
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
      $scope.endpoint = angular.copy(defaults);
    };

    $scope.cancel = function() {
      $scope.reset();
      location.back();
    };

    $scope.getEndpoint = function(id) {
      backendSrv.get('/api/endpoints/'+id).then(function(endpoint) {
        $scope.endpoint = endpoint;
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
    $scope.getLocationsByGroup = function(group) {
      if (group in $scope.locationsByGroup) {
        return $scope.locationsByGroup[group];
      }
    };
    $scope.addMonitors = function() {
      var promises = [];
      _.forEach($scope.checks, function(check) {
        check.endpoint_id = $scope.endpoint.id;
        check.locations = $scope.getLocationsByGroup(check.locationGroup);
        delete check.locationGroup;
        promises.push(backendSrv.put('/api/monitors', check));
      });

      $q.all(promises).then(function() {
        $location.path("/endpoints");
      });
    }

    $scope.add = function() {
      if (!$scope.endpointForm.$valid) {
        return;
      }

      backendSrv.put('/api/endpoints', $scope.endpoint)
        .then(function(resp) {
          $scope.endpoint.id = resp.endpoint.id;
          $scope.addMonitors();
        });
    };

    $scope.init();

  });
});
