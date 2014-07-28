/*

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('grafana.panels.annotations', []);
  app.useModule(module);

  module.controller('AnnotationsEditorCtrl', function($scope, datasourceSrv, $rootScope) {

    var annotationDefaults = {
      name: '',
      datasource: null,
      showLine: true,
      iconColor: '#C0C6BE',
      lineColor: 'rgba(255, 96, 96, 0.592157)',
      iconSize: 13,
      enable: true
    };

    $scope.init = function() {
      $scope.currentAnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
      $scope.datasources = datasourceSrv.getAnnotationSources();

      if ($scope.datasources.length > 0) {
        $scope.currentDatasource = $scope.datasources[0];
      }
    };

    $scope.setDatasource = function() {
      $scope.currentAnnotation.datasource = $scope.currentDatasource.name;
    };

    $scope.edit = function(annotation) {
      $scope.currentAnnotation = annotation;
      $scope.currentIsNew = false;
      $scope.currentDatasource = _.findWhere($scope.datasources, { name: annotation.datasource });

      if (!$scope.currentDatasource) {
        $scope.currentDatasource = $scope.datasources[0];
      }
    };

    $scope.update = function() {
      $scope.currentAnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
    };

    $scope.add = function() {
      $scope.currentAnnotation.datasource = $scope.currentDatasource.name;
      $scope.panel.annotations.push($scope.currentAnnotation);
      $scope.currentAnnnotation = angular.copy(annotationDefaults);
    };

    $scope.hide = function (annotation) {
      annotation.enable = !annotation.enable;
      $rootScope.$broadcast('refresh');
    };

  });
});
