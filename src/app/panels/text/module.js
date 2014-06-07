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
  'underscore',
  'require'
],
function (angular, app, _, require) {
  'use strict';

  var module = angular.module('kibana.panels.text', []);
  app.useModule(module);

  module.controller('text', function($scope) {

    $scope.panelMeta = {
      description : "A static text panel that can use plain text, markdown, or (sanitized) HTML"
    };

    // Set and populate defaults
    var _d = {
      mode    : "markdown", // 'html', 'markdown', 'text'
      content : "",
      style: {},
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.initBaseController(this, $scope);

      $scope.ready = false;
    };

    $scope.render = function() {
      $scope.$emit('render');
    };

    $scope.openEditor = function() {
      //$scope.$emit('open-modal','paneleditor');
      console.log('scope id', $scope.$id);
    };

  });

  module.directive('markdown', function() {
    return {
      restrict: 'E',
      link: function(scope, element) {
        scope.$on('render', function() {
          render_panel();
        });

        function render_panel() {
          require(['./lib/showdown'], function (Showdown) {
            scope.ready = true;
            var converter = new Showdown.converter();
            var text = scope.panel.content.replace(/&/g, '&amp;')
              .replace(/>/g, '&gt;')
              .replace(/</g, '&lt;');
            var htmlText = converter.makeHtml(text);
            element.html(htmlText);
            // For whatever reason, this fixes chrome. I don't like it, I think
            // it makes things slow?
            if(!scope.$$phase) {
              scope.$apply();
            }
          });
        }

        render_panel();
      }
    };
  });

  module.filter('newlines', function() {
    return function (input) {
      return input.replace(/\n/g, '<br/>');
    };
  });

  module.filter('striphtml', function () {
    return function(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;');
    };
  });
});