define([
  'angular',
  'app',
  'lodash',
  'components/panelmeta',
],
function (angular, app, _, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.custom', []);
  app.useModule(module);

  module.controller('CustomPanelCtrl', function($scope, panelSrv) {

    $scope.panelMeta = new PanelMeta({
      description : "A static text panel that can use plain text, markdown, or (sanitized) HTML"
    });

    // set and populate defaults
    var _d = {
    };

    _.defaults($scope.panel, _d);

    panelSrv.init($scope);
  });
});
