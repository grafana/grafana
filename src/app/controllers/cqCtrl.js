define([
  'angular',
  'app',
  'lodash',
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CQEditorCtrl', function($scope, $rootScope, $timeout, datasourceSrv, alertSrv) {

    $scope.init = function() {
      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.setDatasource(null);
      $scope.cqs = null;

      $scope.newQuery = "";
      $scope.newSeries = "";
    };

    $scope.headerNames = {'id': 'Id', 'series': 'Series Name', 'query': 'Query'};

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
        alertSrv.set('Success', 'Continuous Query Dropped', 'success', 3000);

      }, function() {
        alertSrv.set('Error', 'Error dropping continuous query ' + cqID, 'error');
      });
    };

    $scope.addCQ = function() {

      if (!$scope.newSeries || !$scope.newQuery) {
        alertSrv.set('Error', 'Both the query and series name must be set', 'error');
        return;
      }

      var query = $scope.newQuery + " into " + $scope.newSeries;

      $scope.datasource.rawCQ(query).then(function() {
        $scope.listCQs();
        alertSrv.set('Success', 'Continuous Query Added', 'success', 3000);

      }, function() {
        alertSrv.set('Error', 'Error adding continuous query: ' + query, 'error');
      });

    };

    // Sorting
    // Based on http://stackoverflow.com/questions/18789973/sortable-table-columns-with-angularjs

    $scope.sort = {
      column: 'series',
      descending: false
    };

    $scope.sortStyle = function(column) {
      var sort = $scope.sort;
      if (sort.column !== column) {
        return "";
      }
      if (sort.descending) {
        return "icon-circle-arrow-up";
      } else {
        return "icon-circle-arrow-down";
      }
    };

    $scope.changeSorting = function(column) {
      var sort = $scope.sort;
      if (sort.column === column) {
        sort.descending = !sort.descending;
      } else {
        sort.column = column;
        sort.descending = false;
      }
    };

  });

});
