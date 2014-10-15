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
      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.setDatasource(null);
      $scope.cqs = null;

      $scope.newQuery = "";
      $scope.newSeries = "";
    };

    $scope.setDatasource = function(datasource) {
      $scope.datasource = datasourceSrv.get(datasource);

      if (!$scope.datasource || $scope.datasource.type !== 'influxDB') {
        return;
      }

      $scope.listCQs();
    };

    $scope.listCQs = function() {
      $scope.datasource.listContinuousQueries().then(function(cqs) {
        $scope.cqs = _.map(cqs, function(cq_points) {
          var query = {};
          var parts = cq_points[2].split(' into ');

          query.id = cq_points[1];
          query.query = parts[0];
          query.series = parts[1];

          $scope.newQuery = "";
          $scope.newSeries = "";
          return query;
        });
      });
    };

    $scope.deleteCQ = function(cqID) {
      var query = "drop continuous query " + cqID;

      $scope.datasource.rawCQ(query).then(function() {
        $scope.listCQs();
      });
    };

    $scope.addCQ = function() {
      var query = $scope.newQuery + " into " + $scope.newSeries;

      $scope.datasource.rawCQ(query).then(function() {
        $scope.listCQs();
      });

    };

  });

});
