/*

  ## annotations

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.annotations', []);
  app.useModule(module);

  module.controller('AnnotationsCtrl', function($scope, dashboard, $rootScope) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "Annotations"
    };

    // Set and populate defaults
    var _d = {
      annotations: []
    };

    var annotationDefaults = {
      name: '',
      type: 'graphite metric'
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.currentAnnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
    };

    $scope.getAnnotationInfo = function(annotation) {
      return annotation.target;
    };

    $scope.edit = function(annotation) {
      $scope.currentAnnnotation = annotation;
      $scope.currentIsNew = false;
    };

    $scope.getInfo = function(annotation) {
      return annotation.target;
    };

    $scope.update = function() {
      $scope.currentAnnnotation = angular.copy(annotationDefaults);
      $scope.currentIsNew = true;
    };

    $scope.add = function() {
      $scope.panel.annotations.push($scope.currentAnnnotation);
      $scope.currentAnnnotation = angular.copy(annotationDefaults);
    };

    $scope.hide = function (annotation) {
      annotation.enable = !annotation.enable;
      $rootScope.$broadcast('refresh');
    };


  });
});