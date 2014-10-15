define([
  'angular',
  'app',
  'lodash',
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CQEditorCtrl', function($scope, $rootScope, $timeout, datasourceSrv) {

    $scope.init = function() {
      //$scope.datasources = datasourceSrv.getInfluxDBSources();
      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.setDatasource(null);
      $scope.cqs = null;
    };

    $scope.setDatasource = function(datasource) {
      $scope.datasource = datasourceSrv.get(datasource);

      if (!$scope.datasource) {
        $scope.error = "Cannot find datasource " + datasource;
        return;
      }

      $scope.datasource.listContinuousQueries().then(function(cqs) {
        $scope.cqs = _.map(cqs, function(cq_points) {
          var query = {};
          query.id = cq_points[1];
          var parts = cq_points[2].split(' into ');
          query.query = parts[0];
          query.series = parts[1];
          return query;
        });
      });
    };

  });

});
