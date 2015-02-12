define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SitesCtrl', function($scope, $http, backendSrv) {

    var defaults = {
      name: '',
    };

    $scope.init = function() {
      $scope.reset();
      $scope.editor = {index: 0};
      $scope.search = {query: ""};
      $scope.sites = [];
      $scope.getSites();

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

    $scope.edit = function(site) {
      $scope.current = site;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
    };

    $scope.cancel = function() {
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.getSites = function() {
      backendSrv.get('/api/sites').then(function(sites) {
        $scope.sites = sites;
      });
    };
    $scope.remove = function(site) {
      backendSrv.delete('/api/sites/' + site.id).then(function() {
        $scope.getSites();
      });
    };

    $scope.update = function() {
      backendSrv.post('/api/sites', $scope.current).then(function() {
        $scope.editor.index = 0;
        $scope.getLocations();
      });
    };

    $scope.add = function() {
      if (!$scope.editForm.$valid) {
        return;
      }

      backendSrv.put('/api/sites', $scope.current)
        .then(function() {
          $scope.editor.index = 0;
          $scope.getSites();
        });
    };
    $scope.init();

  });
});
