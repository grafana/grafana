define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SharePanelCtrl', function($scope, $location, $timeout, timeSrv, $element) {

    $scope.init = function() {
      $scope.editor = { index: 0 };

      var currentUrl = $location.absUrl();
      var panelId = $scope.panel.id;
      var range = timeSrv.timeRange(false);
      var from = range.from;
      var to = range.to;
      if (_.isDate(from)) {
        from = from.getTime();
      }
      if (_.isDate(to)) {
        to = to.getTime();
      }

      $scope.shareUrl = currentUrl + "?panelId=" + panelId + "&fullscreen";
      $scope.shareUrl += "&from=" + from;
      $scope.shareUrl += "&to=" + to;

      $scope.forCurrent = true;
      $scope.toPanel = true;

      $timeout(function() {
        var input = $element.find('[data-share-panel-url]');
        input.focus();
        input.select();
      });
    };

    $scope.init();

  });

});
