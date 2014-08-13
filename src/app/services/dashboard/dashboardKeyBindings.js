define([
  'angular',
  'jquery',
  'services/all'
],
function(angular, $) {
  "use strict";

  var module = angular.module('grafana.services');

  module.service('dashboardKeybindings', function($rootScope, keyboardManager) {

    this.shortcuts = function(scope) {

      scope.onAppEvent('panel-fullscreen-exit', function() {
        scope.dashboardViewState.update({ fullscreen: false });
      });

      scope.onAppEvent('dashboard-saved', function() {
        if (scope.dashboardViewState.fullscreen) {
          scope.emitAppEvent('panel-fullscreen-exit');
        }
      });

      scope.$on('$destroy', function() {
        keyboardManager.unbind('ctrl+f');
        keyboardManager.unbind('ctrl+h');
        keyboardManager.unbind('ctrl+s');
        keyboardManager.unbind('ctrl+r');
        keyboardManager.unbind('ctrl+z');
        keyboardManager.unbind('esc');
      });

      keyboardManager.bind('ctrl+f', function(evt) {
        scope.emitAppEvent('open-search', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+h', function() {
        var current = scope.dashboard.hideControls;
        scope.dashboard.hideControls = !current;
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+s', function(evt) {
        scope.emitAppEvent('save-dashboard', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+r', function() {
        scope.dashboard.emit_refresh();
      }, { inputDisabled: true });

      keyboardManager.bind('ctrl+z', function(evt) {
        scope.emitAppEvent('zoom-out', evt);
      }, { inputDisabled: true });

      keyboardManager.bind('esc', function() {
        var popups = $('.popover.in');
        if (popups.length > 0) {
          return;
        }
        // close modals
        var modalData = $(".modal").data();
        if (modalData && modalData.$scope && modalData.$scope.dismiss) {
          modalData.$scope.dismiss();
        }

        scope.emitAppEvent('panel-fullscreen-exit');
      }, { inputDisabled: true });
    };
  });
});
