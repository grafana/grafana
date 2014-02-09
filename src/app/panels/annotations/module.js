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

  module.controller('AnnotationsCtrl', function($scope, dashboard, annotationsSrv, $rootScope) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "Annotations"
    };

    // Set and populate defaults
    var _d = {
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.annotationList = annotationsSrv.annotationList;
    };

    $scope.hideAll = function () {
      $scope.panel.hideAll = !$scope.panel.hideAll;

      _.each($scope.annotationList, function(annotation) {
        annotation.enabled = !$scope.panel.hideAll;
      });
    };

    $scope.hide = function (annotation) {
      annotation.enabled = !annotation.enabled;
      $scope.panel.hideAll = !annotation.enabled;

      $rootScope.$broadcast('refresh');
    };


  });
});