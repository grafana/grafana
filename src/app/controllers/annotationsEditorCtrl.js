define([
  'angular',
  'app',
  'lodash',
  'jquery'
],
function (angular, app, _, $) {
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
      $scope.currentAnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
      $scope.editor = { index: 0 };
      $scope.datasources = datasourceSrv.getAnnotationSources();
      $scope.annotations = $scope.dashboard.annotations.list;

      if ($scope.datasources.length > 0) {
        $scope.currentDatasource = $scope.datasources[0];
      }

      $scope.$watch('editor.index', function(newVal) {
        if (newVal !== 2) {
          $scope.reset();
        }
      });
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

      $scope.editor.index = 2;
      $(".tooltip.in").remove();
    };

    $scope.reset = function() {
      $scope.currentAnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
    };

    $scope.add = function() {
      $scope.currentAnnotation.datasource = $scope.currentDatasource.name;
      $scope.annotations.push($scope.currentAnnotation);
      $scope.currentAnnotation = angular.copy(annotationDefaults);
    };

    $scope.removeAnnotation = function(annotation) {
      var index = _.indexOf($scope.annotations, annotation);
      $scope.annotations.splice(index, 1);
    };

  });

});
