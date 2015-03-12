define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LocationCtrl', function($scope, $http, backendSrv) {

    var defaults = {
      name: '',
      region: 'AMER',
      country: 'US',
      provider: 'Custom'
    };

    $scope.init = function() {
      $scope.reset();
      $scope.editor = {index: 0};
      $scope.search = {query: ""};
      $scope.locations = [];
      $scope.getLocations();

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

    $scope.edit = function(loc) {
      $scope.current = loc;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
    };

    $scope.cancel = function() {
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.getLocations = function() {
      backendSrv.get('/api/locations').then(function(locations) {
        $scope.locations = locations;
      });
    };
    $scope.remove = function(loc) {
      backendSrv.delete('/api/locations/' + loc.id).then(function() {
        $scope.getLocations();
      });
    };

    $scope.update = function() {
      backendSrv.post('/api/locations', $scope.current).then(function() {
        $scope.editor.index = 0;
        $scope.getLocations();
      });
    };

    $scope.add = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.put('/api/locations', $scope.current)
        .then(function() {
          $scope.editor.index = 0;
          $scope.getLocations();
        });
    };
    $scope.init();
  });
});
