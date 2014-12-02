define([
  'angular',
  'app',
  'lodash',
  'kbn'
],
function (angular, app, _, kbn) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('GraphiteImportCtrl', function($scope, $rootScope, $timeout, datasourceSrv, $location) {

    $scope.init = function() {
      $scope.datasources = datasourceSrv.getMetricSources();
      $scope.setDatasource(null);
    };

    $scope.setDatasource = function(datasource) {
      $scope.datasource = datasourceSrv.get(datasource);

      if (!$scope.datasource) {
        $scope.error = "Cannot find datasource " + datasource;
        return;
      }
    };

    $scope.listAll = function(query) {
      delete $scope.error;

      $scope.datasource.listDashboards(query)
        .then(function(results) {
          $scope.dashboards = results;
        })
        .then(null, function(err) {
          $scope.error = err.message || 'Error while fetching list of dashboards';
        });
    };

    $scope.import = function(dashName) {
      delete $scope.error;

      $scope.datasource.loadDashboard(dashName)
        .then(function(results) {
          if (!results.data || !results.data.state) {
            throw { message: 'no dashboard state received from graphite' };
          }

          graphiteToGrafanaTranslator(results.data.state, $scope.datasource.name);
        })
        .then(null, function(err) {
          $scope.error = err.message || 'Failed to import dashboard';
        });
    };

    function graphiteToGrafanaTranslator(state, datasource) {
      var graphsPerRow = 2;
      var rowHeight = 300;
      var rowTemplate;
      var currentRow;
      var panel;

      rowTemplate = {
        title: '',
        panels: [],
        height: rowHeight
      };

      currentRow = angular.copy(rowTemplate);

      var newDashboard = angular.copy($scope.dashboard);
      newDashboard.rows = [];
      newDashboard.title = state.name;
      newDashboard.rows.push(currentRow);

      _.each(state.graphs, function(graph, index) {
        if (currentRow.panels.length === graphsPerRow) {
          currentRow = angular.copy(rowTemplate);
          newDashboard.rows.push(currentRow);
        }

        panel = {
          type: 'graph',
          span: 12 / graphsPerRow,
          title: graph[1].title,
          targets: [],
          datasource: datasource,
          id: index + 1
        };

        _.each(graph[1].target, function(target) {
          panel.targets.push({
            target: target
          });
        });

        currentRow.panels.push(panel);
      });

      window.grafanaImportDashboard = newDashboard;
      $location.path('/dashboard/import/' + kbn.slugifyForUrl(newDashboard.title));

      $scope.dismiss();
    }

  });

});
