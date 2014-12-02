define([
  'angular',
  'lodash',
  'jquery'
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AnnotationsEditorCtrl', function($scope, datasourceSrv) {
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
      $scope.editor = { index: 0 };
      $scope.datasources = datasourceSrv.getAnnotationSources();
      $scope.annotations = $scope.dashboard.annotations.list;
      $scope.reset();

      $scope.$watch('editor.index', function(newVal) {
        if (newVal !== 2) {
          $scope.reset();
        }
      });
    };

    $scope.datasourceChanged = function() {
      $scope.currentDatasource = _.findWhere($scope.datasources, { name: $scope.currentAnnotation.datasource });
      if (!$scope.currentDatasource) {
        $scope.currentDatasource = $scope.datasources[0];
      }
    };

    $scope.edit = function(annotation) {
      $scope.currentAnnotation = annotation;
      $scope.currentIsNew = false;
      $scope.datasourceChanged();

      $scope.editor.index = 2;
      $(".tooltip.in").remove();
    };

    $scope.reset = function() {
      $scope.currentAnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
      $scope.datasourceChanged();
      $scope.currentAnnotation.datasource = $scope.currentDatasource.name;
    };

    $scope.update = function() {
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.add = function() {
      $scope.annotations.push($scope.currentAnnotation);
      $scope.reset();
      $scope.editor.index = 0;
    };

    $scope.removeAnnotation = function(annotation) {
      var index = _.indexOf($scope.annotations, annotation);
      $scope.annotations.splice(index, 1);
    };

  });

});
