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

      if ($scope.panel) {
        $scope.toPanel = true;
      }

      $scope.includeTemplateVars = true;
      $scope.buildUrl();
    };

    $scope.buildUrl = function() {
      var baseUrl = $location.absUrl();
      var queryStart = baseUrl.indexOf('?');

      if (queryStart !== -1) {
        baseUrl = baseUrl.substring(0, queryStart);
      }

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
        params.panelId = $scope.panel.id;
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

      $scope.shareUrl = baseUrl + "?" + paramsArray.join('&');
      $scope.imageUrl = $scope.shareUrl.replace('/dashboard/db/', '/render/dashboard/solo/');
      $scope.imageUrl += '&width=1000';
      $scope.imageUrl += '&height=500';

      $timeout(function() {
        var input = $element.find('[data-share-panel-url]');
        input.focus();
        input.select();
      }, 10);

    };

    $scope.init();

  });

});
