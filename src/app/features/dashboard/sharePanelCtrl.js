define([
  'angular',
  'lodash',
  'require',
  'config',
],
function (angular, _, require, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SharePanelCtrl', function($scope, $location, $timeout, timeSrv, $element, templateSrv) {

    $scope.init = function() {
      $scope.editor = { index: 0 };
      $scope.options = {
        forCurrent: true,
        toPanel: $scope.panel ? true : false,
        includeTemplateVars: true
      };

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

      if ($scope.options.includeTemplateVars) {
        _.each(templateSrv.variables, function(variable) {
          params['var-' + variable.name] = variable.current.text;
        });
      }
      else {
        _.each(templateSrv.variables, function(variable) {
          delete params['var-' + variable.name];
        });
      }

      if (!$scope.options.forCurrent) {
        delete params.from;
        delete params.to;
      }

      if ($scope.options.toPanel) {
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

      $scope.soloUrl = $scope.shareUrl.replace('/dashboard/db/', '/dashboard/solo/');
      $scope.iframeHtml = '<iframe src="' + $scope.soloUrl + '" width="450" height="200" frameborder="0"></iframe>';

      $scope.imageUrl = $scope.shareUrl.replace('/dashboard/db/', '/render/dashboard/solo/');
      $scope.imageUrl += '&width=1000';
      $scope.imageUrl += '&height=500';
    };

    $scope.init();

  });

  module.directive('clipboardButton',function() {
    return function(scope, elem) {
      require(['ZeroClipboard'], function(ZeroClipboard) {
        ZeroClipboard.config({
          swfPath: config.appSubUrl + '/public/vendor/ZeroClipboard.swf'
        });
        new ZeroClipboard(elem[0]);
      });
    };
  });

});
