define([
  'angular',
  'app',
  'config'
],
function (angular, app, config) {
  'use strict';

  var module = angular.module('kibana.panels.navigation', []);
  app.useModule(module);

  module.controller('navigation', function($scope) {

    $scope.panelMeta = {
      description : "A navbar panel that provides easy navigation with the use of tags."
    };

    $scope.init = function() {
      $scope.initBaseController(this, $scope);
      $scope.results = {dashboards: []};
      $scope.getDashboards();
    };

    $scope.getDashboards = function() {
      var request = $scope.ejs.Request().indices(config.grafana_index).types('dashboard');

      // Queries elasticsearch and returns all dashboards with tags
      return request
        .query($scope.ejs.QueryStringQuery('*').defaultField('tags'))
        .sort('_uid')
        .size(200).doSearch()
        .then(function(results) {
          $scope.results.dashboards = results.hits.hits;
        });
    };

    $scope.openEditor = function() {
      //$scope.$emit('open-modal','paneleditor');
      console.log('scope id', $scope.$id);
    };
  });
});
