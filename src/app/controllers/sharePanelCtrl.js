define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SharePanelCtrl', function($scope, $location, $timeout, timeSrv, $element, templateSrv) {

    $scope.init = function() {
      $scope.editor = { index: 0 };
      $scope.forCurrent = true;
      $scope.toPanel = true;
      $scope.includeTemplateVars = true;

      $scope.buildUrl();
    };

    $scope.buildUrl = function() {
      var baseUrl = $location.absUrl();
      var queryStart = baseUrl.indexOf('?');

      if (queryStart !== -1) {
        baseUrl = baseUrl.substring(0, queryStart);
      }

      var panelId = $scope.panel.id;
      var params = angular.copy($location.search());

      var range = timeSrv.timeRangeForUrl();
      params.from = range.from;
      params.to = range.to;

      if ($scope.includeTemplateVars) {
        _.each(templateSrv.variables, function(variable) {
          params['var-' + variable.name] = variable.current.text;
        });
      }
      else {
        _.each(templateSrv.variables, function(variable) {
          delete params['var-' + variable.name];
        });
      }

      if (!$scope.forCurrent) {
        delete params.from;
        delete params.to;
      }

      if ($scope.toPanel) {
        params.panelId = panelId;
        params.fullscreen = true;
      } else {
        delete params.panelId;
        delete params.fullscreen;
      }

      var paramsArray = [];
      _.each(params, function(value, key) {
        if (value === null) { return; }
        if (value === true) {
          paramsArray.push(key);
        } else {
          key += '=' + encodeURIComponent(value);
          paramsArray.push(key);
        }
      });

      $scope.shareUrl = baseUrl + "?" + paramsArray.join('&') ;

      $timeout(function() {
        var input = $element.find('[data-share-panel-url]');
        input.focus();
        input.select();
      }, 10);

    };

    $scope.init();

  });

});
