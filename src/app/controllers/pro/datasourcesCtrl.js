define([
  'angular',
  'services/pro/backendSrv',
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

    $scope.init = function() {
      $scope.current = angular.copy(defaults);
    };

    $scope.addDatasource = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.post('/api/admin/datasources/add', $scope.current)
        .then(function(result) {
          console.log('add datasource result', result);
        });
    };

    $scope.init();

  });
});
