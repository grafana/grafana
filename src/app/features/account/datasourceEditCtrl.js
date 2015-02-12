define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DataSourceEditCtrl', function($scope, $http, backendSrv, $routeParams, $location) {

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

    $scope.update = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.post('/api/datasources', $scope.current).then(function() {
        $location.path("account/datasources");
      });
    };

    $scope.add = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.put('/api/datasources', $scope.current)
        .then(function() {
          $scope.editor.index = 0;
          $scope.getDatasources();
        });
    };

    $scope.init();

  });
});
