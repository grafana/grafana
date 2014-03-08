define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('bodyClass', function() {
      return {
        link: function($scope, elem) {

          var lastPulldownVal;
          var lastHideControlsVal;

          $scope.$watch('dashboard.current.pulldowns', function() {
            var panel = _.find($scope.dashboard.current.pulldowns, function(pulldown) { return pulldown.enable; });
            var panelEnabled = panel ? panel.enable : false;
            if (lastPulldownVal !== panelEnabled) {
              elem.toggleClass('submenu-controls-visible', panelEnabled);
              lastPulldownVal = panelEnabled;
            }
          }, true);

          $scope.$watch('dashboard.current.hideControls', function() {
            var hideControls = $scope.dashboard.current.hideControls || $scope.playlist_active;

            if (lastHideControlsVal !== hideControls) {
              elem.toggleClass('hide-controls', hideControls);
              lastHideControlsVal = hideControls;
            }
          });

          $scope.$watch('playlist_active', function() {
            elem.toggleClass('hide-controls', $scope.playlist_active === true);
            elem.toggleClass('playlist-active', $scope.playlist_active === true);
          });
        }
      };
    });

});