define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DataSourcesCtrl', function($scope, $http, backendSrv) {

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
      $scope.reset();
      $scope.editor = {index: 0};
      $scope.datasources = [];
      $scope.getDatasources();

      $scope.$watch('editor.index', function(newVal) {
        if (newVal !== 2) {
          $scope.reset();
        }
      });
    };

    $scope.reset = function() {
      $scope.current = angular.copy(defaults);
      $scope.currentIsNew = true;
    };

    $scope.edit = function(ds) {
      $scope.current = ds;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
    };

    $scope.cancel = function() {
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.getDatasources = function() {
      backendSrv.get('/api/datasources').then(function(results) {
        $scope.datasources = results;
      });
    };

    $scope.remove = function(ds) {
      backendSrv.delete('/api/datasources/' + ds.id).then(function() {
        $scope.getDatasources();
      });
    };

    $scope.update = function() {
      backendSrv.post('/api/datasources', $scope.current).then(function() {
        $scope.editor.index = 0;
        $scope.getDatasources();
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
