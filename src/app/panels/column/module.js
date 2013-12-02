/** @scratch /panels/5
 * include::panels/column.asciidoc[]
 */

/** @scratch /panels/column/0
 * == Column
 * Status: *Stable*
 *
 * A pseudo panel that lets you add other panels to be arranged in a column with defined heights.
 * While the column panel is stable, it does have many limitations, including the inability to drag
 * and drop panels within its borders. It may be removed in a future release.
 *
 */
define([
  'angular',
  'app',
  'underscore',
  'config'
],
function (angular, app, _, config) {
  'use strict';

  var module = angular.module('kibana.panels.column', []);

  app.useModule(module);

  module.controller('column', function($scope, $rootScope, $timeout) {
    $scope.panelMeta = {
      status  : "Stable",
      description : "A pseudo panel that lets you add other panels to be arranged in a column with"+
        "defined heights."
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/column/3
       * === Parameters
       *
       * panel:: An array of panel objects
       */
      panels : []
    };
    _.defaults($scope.panel,_d);

    $scope.init = function(){
      $scope.reset_panel();
    };

    $scope.toggle_row = function(panel) {
      panel.collapse = panel.collapse ? false : true;
      if (!panel.collapse) {
        $timeout(function() {
          $scope.send_render();
        });
      }
    };

    $scope.send_render = function() {
      $scope.$broadcast('render');
    };

    $scope.add_panel = function(panel) {
      $scope.panel.panels.push(panel);
    };

    $scope.reset_panel = function(type) {
      $scope.new_panel = {
        loading: false,
        error: false,
        sizeable: false,
        span: 12,
        height: "150px",
        editable: true,
        type: type,
        draggable: false
      };
    };

  });

  module.directive('columnEdit', function($compile,$timeout) {
    return {
      scope : {
        new_panel:"=panel",
        row:"=",
        config:"=",
        dashboards:"=",
        type:"=type"
      },
      link: function(scope, elem) {
        scope.$on('render', function () {

          // Make sure the digest has completed and populated the attributes
          $timeout(function() {
            // Create a reference to the new_panel as panel so that the existing
            // editors work with our isolate scope
            scope.panel = scope.new_panel;
            var template = '<div ng-include src="partial(\'panelgeneral\')"></div>';

            if(!(_.isUndefined(scope.type)) && scope.type !== "") {
              template = template+'<div ng-include src="\'app/panels/'+scope.type+'/editor.html\'"></div>';
            }
            elem.html($compile(angular.element(template))(scope));
          });
        });
      }
    };
  });

  module.filter('withoutColumn', function() {
    return function() {
      return _.without(config.panel_names,'column');
    };
  });
});