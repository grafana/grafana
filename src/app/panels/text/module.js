define([
  'angular',
  'app',
  'lodash',
  'require',
],
function (angular, app, _, require) {
  'use strict';

  var module = angular.module('grafana.panels.text', []);
  app.useModule(module);

  var converter;

  module.controller('text', function($scope, templateSrv, $sce, panelSrv) {

    $scope.panelMeta = {
      description : "A static text panel that can use plain text, markdown, or (sanitized) HTML"
    };

    // Set and populate defaults
    var _d = {
      title: 'default title',
      mode    : "markdown", // 'html', 'markdown', 'text'
      content : "",
      style: {},
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init(this);
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
      var text = content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;');

      if (converter) {
        $scope.updateContent(converter.makeHtml(text));
      }
      else {
        require(['./lib/showdown'], function (Showdown) {
          converter = new Showdown.converter();
          $scope.updateContent(converter.makeHtml(text));
        });
      }
    };

    $scope.updateContent = function(html) {
      try {
        $scope.content = $sce.trustAsHtml(templateSrv.replace(html));
      } catch(e) {
        console.log('Text panel error: ', e);
        $scope.content = $sce.trustAsHtml(html);
      }

      if(!$scope.$$phase) {
        $scope.$digest();
      }
    };

    $scope.openEditor = function() {
    };

    $scope.init();
  });
});
