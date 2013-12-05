/** @scratch /panels/5
 * include::panels/text.asciidoc[]
 */

/** @scratch /panels/text/0
 * == text
 * Status: *Stable*
 *
 * The text panel is used for displaying static text formated as markdown, sanitized html or as plain
 * text.
 *
 */
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.graph', []);
  app.useModule(module);

  module.controller('graph', function($scope) {
    $scope.panelMeta = {
      status  : "Unstable",
      description : "A graphite graph module"
    };

    // Set and populate defaults
    var _d = {
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.ready = false;
      $scope.saySomething = "something!";
    };

  });

});