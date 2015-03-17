define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CollectorCtrl', function($scope, $http, backendSrv, contextSrv) {
    $scope.init = function() {
      $scope.collector_filter = "";
      $scope.status_filter = "All Statuses";
      $scope.sort_field = "Collector";
      $scope.collectors = [];
      $scope.getCollectors();
    };
    $scope.collectorTags = function() {
      var map = {};
      _.forEach($scope.collectors, function(collector) {
        _.forEach(collector.tags, function(tag) {
          map[tag] = true;
        });
      });
      return Object.keys(map);
    }
    $scope.setCollectorFilter = function(tag) {
      $scope.collector_filter = tag;
    };

    $scope.edit = function(loc) {
      $scope.current = loc;
      $scope.currentIsNew = false;
      $scope.editor.index = 2;
    };

    $scope.getCollectors = function() {
      backendSrv.get('/api/locations').then(function(collectors) {
        $scope.collectors = collectors;
      });
    };

    $scope.remove = function(loc) {
      backendSrv.delete('/api/locations/' + loc.id).then(function() {
        $scope.getCollectors();
      });
    };

    $scope.init();
  });
});
