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
      var range = timeSrv.timeRange(false);
      var params = angular.copy($location.search());

      if (_.isString(range.to) && range.to.indexOf('now')) {
        range = timeSrv.timeRange();
      }

      params.from = range.from;
      params.to = range.to;

      if (_.isDate(params.from)) { params.from = params.from.getTime(); }
      if (_.isDate(params.to)) { params.to = params.to.getTime(); }

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
        var str = key;
        if (value !== true) {
          str += '=' + encodeURIComponent(value);
        }
        paramsArray.push(str);
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
