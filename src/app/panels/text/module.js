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
  'require',
  'services/filterSrv'
],
function (angular, app, _, require) {
  'use strict';

  var module = angular.module('kibana.panels.text', []);
  app.useModule(module);

  module.controller('text', function($scope, filterSrv) {

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
      $scope.$on('refresh', $scope.render);
      $scope.render();
    };

    $scope.render = function() {
      if ($scope.panel.mode === 'markdown') {
        $scope.renderMarkdown($scope.panel.content);
      }
      else if ($scope.panel.mode === 'html') {
        $scope.updateContent($scope.panel.content);
      }
      else if ($scope.panel.mode === 'text') {
        $scope.renderText($scope.panel.content);
      }
    };

    $scope.renderText = function(content) {
      content = content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br/>');

      $scope.updateContent(content);
    };

    $scope.renderMarkdown = function(content) {
      require(['./lib/showdown'], function (Showdown) {
        var converter = new Showdown.converter();
        var text = content
          .replace(/&/g, '&amp;')
          .replace(/>/g, '&gt;')
          .replace(/</g, '&lt;');

        $scope.updateContent(converter.makeHtml(text));
      });
    };

    $scope.updateContent = function(html) {
      try {
        $scope.content = filterSrv.applyTemplateToTarget(html);

        if(!$scope.$$phase) {
          $scope.$apply();
        }
      } catch(e) {
      }
    };

    $scope.openEditor = function() {
    };

  });
});
