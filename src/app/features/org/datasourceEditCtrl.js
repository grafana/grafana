define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DataSourceEditCtrl', function($scope, $http, backendSrv, $routeParams, $location, datasourceSrv) {

    var defaults = {
      name: '',
      type: 'graphite',
      url: '',
      access: 'proxy'
    };

    $scope.types = [
      { name: 'Graphite', type: 'graphite' },
      { name: 'InfluxDB', type: 'influxdb' },
      { name: 'Elasticsearch', type: 'elasticsearch' },
      { name: 'OpenTSDB', type: 'opentsdb' },
    ];

    $scope.init = function() {
      $scope.isNew = true;
      $scope.datasources = [];

      if ($routeParams.id) {
        $scope.isNew = false;
        $scope.getDatasourceById($routeParams.id);
      } else {
        $scope.current = angular.copy(defaults);
      }
    };

    $scope.getDatasourceById = function(id) {
      backendSrv.get('/api/datasources/' + id).then(function(ds) {
        $scope.current = ds;
      });
    };

    $scope.updateFrontendSettings = function() {
      backendSrv.get('/api/frontend/settings').then(function(settings) {
        datasourceSrv.init(settings.datasources);
      });
    };

    $scope.update = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.post('/api/datasources', $scope.current).then(function() {
        $scope.updateFrontendSettings();
        $location.path("datasources");
      });
    };

    $scope.add = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.put('/api/datasources', $scope.current).then(function() {
        $scope.updateFrontendSettings();
        $location.path("datasources");
      });
    };

    $scope.init();

  });
});
