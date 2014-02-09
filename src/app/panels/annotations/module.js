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

  module.controller('AnnotationsCtrl', function($scope) {

    $scope.panelMeta = {
      status  : "Stable",
      description : "Annotations"
    };

    // Set and populate defaults
    var _d = {
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.panel.annotations = [
        {
          type: 'graphite-target',
          target: 'metric'
        },
        {
          type: 'graphite-target',
          target: 'metric2'
        }
      ];
    };


  });
});