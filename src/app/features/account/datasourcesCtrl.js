define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('DataSourcesCtrl', function($scope, $http, backendSrv) {

    $scope.init = function() {
      $scope.datasources = [];
      $scope.getDatasources();
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

    $scope.init();

  });
});
