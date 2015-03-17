define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var datasourceTypes = [];

  module.controller('DataSourceEditCtrl', function($scope, $q, backendSrv, $routeParams, $location, datasourceSrv) {

    $scope.httpConfigPartialSrc = 'app/features/org/partials/datasourceHttpConfig.html';

    var defaults = {
      name: '',
      type: 'graphite',
      url: '',
      access: 'proxy'
    };

    $scope.init = function() {
      $scope.isNew = true;
      $scope.datasources = [];

      $scope.loadDatasourceTypes().then(function() {
        if ($routeParams.id) {
          $scope.isNew = false;
          $scope.getDatasourceById($routeParams.id);
        } else {
          $scope.current = angular.copy(defaults);
          $scope.typeChanged();
        }
      });
    };

    $scope.loadDatasourceTypes = function() {
      if (datasourceTypes.length > 0) {
        $scope.types = datasourceTypes;
        return $q.when(null);
      }

      return backendSrv.get('/api/datasources/plugins').then(function(plugins) {
        datasourceTypes = plugins;
        $scope.types = plugins;
      });
    };

    $scope.getDatasourceById = function(id) {
      backendSrv.get('/api/datasources/' + id).then(function(ds) {
        $scope.current = ds;
        $scope.typeChanged();
      });
    };

    $scope.typeChanged = function() {
      $scope.datasourceMeta = $scope.types[$scope.current.type];
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
