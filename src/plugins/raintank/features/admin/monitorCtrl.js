define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('MonitorCtrl', function($scope, $http, backendSrv) {

    var defaults = {
      name: '',
      namespace: 'network',
      site: null,
      monitor_type_id: 1,
      locations: [],
      settings: [],
      enabled: true,
      frequency: 10,
    };

    $scope.init = function() {
      $scope.reset();
      $scope.editor = {index: 0};
      $scope.search= {query: ""};

      $scope.locations = {};
      $scope.getLocations();

      $scope.monitors = [];
      $scope.monitor_types = {};
      $scope.sites = {};
      $scope.getMonitorTypes();
      $scope.getSites();
      $scope.getMonitors()
     
      $scope.$watch('editor.index', function(newVal) {
        if (newVal !== 2) {
          $scope.reset();
        }
      });
    };

    $scope.location_list = function(mon) {
      var locationCodes = [];
      _.forEach(mon.locations, function(loc) {
        if (loc in $scope.locations) {
          locationCodes.push($scope.locations[loc].name);
        }
      });
      return locationCodes.join(",");
    }

    $scope.getLocations = function() {
      var locationMap = {};
      backendSrv.get('/api/locations').then(function(locations) {
        _.forEach(locations, function(loc) {
          locationMap[loc.id] = loc;
        });
        $scope.locations = locationMap;
      });
    };

    $scope.reset = function() {
      $scope.current = angular.copy(defaults);
      $scope.currentIsNew = true;
      console.log($scope.current);
      console.log($scope.monitor_types)
    };

    $scope.edit = function(mon) {
      $scope.current = mon;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
      console.log($scope);
    };

    $scope.cancel = function() {
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.getMonitors = function() {
      backendSrv.get('/api/monitors').then(function(monitors) {
        $scope.monitors = monitors;
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
    $scope.getSites = function() {
      backendSrv.get('/api/sites').then(function(sites) {
        var sitesMap = {};
        _.forEach(sites, function(site) {
          sitesMap[site.id] = site;
        });
        $scope.sites = sitesMap;
      });
    };

    $scope.remove = function(mon) {
      backendSrv.delete('/api/monitors/' + mon.id).then(function() {
        $scope.getMonitors();
      });
    };

    $scope.update = function() {
      backendSrv.post('/api/monitors', $scope.current).then(function() {
        $scope.editor.index = 0;
        $scope.getMonitors();
      });
    };

    $scope.add = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.put('/api/monitors', $scope.current)
        .then(function() {
          $scope.editor.index = 0;
          $scope.getMonitors();
        });
    };

    $scope.typeChanged = function() {
      $scope.current.settings = [];
      console.log($scope.current);
    }

    $scope.currentSettingByVariable = function(variable) {
      var s = {
        "variable": variable,
        "value": null
      };
      var found = false
      _.forEach($scope.current.settings, function(setting) {
        if (found) {
          return;
        }
        if (setting.variable == variable) {
          s = setting;
          found = true;
        }
      });
      if (! found ) {
        $scope.current.settings.push(s);
      }
      return s;
    }

    $scope.init();

  });
});
