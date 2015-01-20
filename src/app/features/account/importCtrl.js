define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ImportCtrl', function($scope, $http, backendSrv, datasourceSrv) {

    $scope.init = function() {
      $scope.datasources = [];
      $scope.sourceName = 'grafana';
      $scope.destName = 'grafana';
      $scope.imported = [];
      $scope.dashboards = [];
      $scope.infoText = '';
      $scope.importing = false;

      _.each(datasourceSrv.getAll(), function(ds) {
        if (ds.type === 'influxdb' || ds.type === 'elasticsearch') {
          $scope.sourceName = ds.name;
          $scope.datasources.push(ds.name);
        } else if (ds.type === 'grafana') {
          $scope.datasources.push(ds.name);
        }
      });
    };

    $scope.startImport = function() {
      $scope.sourceDs = datasourceSrv.get($scope.sourceName);
      $scope.destDs = datasourceSrv.get($scope.destName);

      $scope.sourceDs.searchDashboards('title:').then(function(results) {
        $scope.dashboards = results.dashboards;

        if ($scope.dashboards.length === 0) {
          $scope.infoText = 'No dashboards found';
          return;
        }

        $scope.importing = true;
        $scope.imported = [];
        $scope.next();
      });
    };

    $scope.next = function() {
      if ($scope.dashboards.length === 0) {
        $scope.infoText = "Done! Imported " + $scope.imported.length + " dashboards";
      }

      var dash = $scope.dashboards.shift();
      if (!dash.title) {
        console.log(dash);
        return;
      }

      var infoObj = {name: dash.title, info: 'Importing...'};
      $scope.imported.push(infoObj);
      $scope.infoText = "Importing " + $scope.imported.length + '/' + ($scope.imported.length + $scope.dashboards.length);

      $scope.sourceDs.getDashboard(dash.id).then(function(loadedDash) {
        $scope.destDs.saveDashboard(loadedDash).then(function() {
          infoObj.info = "Done!";
          $scope.next();
        }, function(err) {
          infoObj.info = "Error: " + err;
          $scope.next();
        });
      });
    };

    $scope.init();

  });
});
